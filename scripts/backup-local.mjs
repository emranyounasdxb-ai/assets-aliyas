import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGzip, createGunzip } from "node:zlib";
import path from "node:path";
import { tables } from "../database/schema.mjs";
import { databasePool, sql, closeDatabase } from "../database/sql.mjs";
const root = process.cwd();
const verify = process.argv[2] === "--verify";
let encoded = process.env.BACKUP_ENCRYPTION_KEY;
if (!encoded) {
  assert.ok(
    !verify && process.env.NODE_ENV !== "production",
    "Configure the original backup encryption key privately",
  );
  encoded = randomBytes(32).toString("base64");
  await appendFile(
    ".env.local",
    String.fromCharCode(10) +
      `BACKUP_ENCRYPTION_KEY=${encoded}` +
      String.fromCharCode(10),
  );
}
const key = Buffer.from(encoded, "base64");
assert.equal(key.length, 32, "A 32-byte backup key is required");
function tar(args) {
  const child = spawn("tar", args, {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stderr.resume();
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error("Private storage archive check failed")),
    );
  });
  return { child, done };
}
async function collect(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}
try {
  if (verify) {
    const directory = path.resolve(process.argv[3] || "");
    assert.ok(
      directory.startsWith(path.join(root, "backups") + path.sep),
      "Choose a backup in this project",
    );
    const manifest = JSON.parse(
      await readFile(path.join(directory, "manifest.json"), "utf8"),
    );
    assert.equal(manifest.format, "aliyas-mariadb-v1");
    for (const entry of manifest.files) {
      assert.ok(
        ["database.json.gz.enc", "storage.tar.gz.enc"].includes(entry.file),
      );
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(entry.iv, "hex"),
      );
      decipher.setAuthTag(Buffer.from(entry.tag, "hex"));
      if (entry.file === "database.json.gz.enc") {
        const unzip = createGunzip();
        const reading = collect(unzip);
        await pipeline(
          createReadStream(path.join(directory, entry.file)),
          decipher,
          unzip,
        );
        const data = JSON.parse((await reading).toString());
        assert.equal(data.format, manifest.format);
        for (const [table, count] of Object.entries(manifest.rows))
          assert.equal(data.tables[table].length, count);
      } else {
        const { child, done } = tar(["-tzf", "-"]);
        child.stdout.resume();
        await Promise.all([
          pipeline(
            createReadStream(path.join(directory, entry.file)),
            decipher,
            child.stdin,
          ),
          done,
        ]);
      }
    }
    console.log(
      "Both encrypted archives authenticated; database tables and file archive verified. Live data was not changed.",
    );
  } else {
    const connection = await databasePool().getConnection();
    const data = { format: "aliyas-mariadb-v1", tables: {} };
    try {
      await connection.beginTransaction();
      for (const table of Object.keys(tables)) {
        if (["sessions", "login_attempts"].includes(table)) continue;
        data.tables[table] = await sql(
          connection,
          `select * from ${table} order by id`,
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    const directory = path.join(
      root,
      "backups",
      new Date().toISOString().replaceAll(":", "-").replace(".", "-"),
    );
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const manifest = {
      format: data.format,
      createdAt: new Date().toISOString(),
      rows: Object.fromEntries(
        Object.entries(data.tables).map(([table, rows]) => [
          table,
          rows.length,
        ]),
      ),
      files: [],
    };
    async function encrypted(stream, file) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      await pipeline(
        stream,
        cipher,
        createWriteStream(path.join(directory, file), {
          mode: 0o600,
          flags: "wx",
        }),
      );
      manifest.files.push({
        file,
        iv: iv.toString("hex"),
        tag: cipher.getAuthTag().toString("hex"),
      });
    }
    const gzip = createGzip();
    const writing = encrypted(gzip, "database.json.gz.enc");
    await pipeline(Readable.from([JSON.stringify(data)]), gzip);
    await writing;
    assert.ok(
      path.isAbsolute(process.env.PRIVATE_STORAGE_DIR || ""),
      "Configure private storage",
    );
    await mkdir(process.env.PRIVATE_STORAGE_DIR, {
      recursive: true,
      mode: 0o700,
    });
    const { child, done } = tar([
      "-czf",
      "-",
      "-C",
      process.env.PRIVATE_STORAGE_DIR,
      ".",
    ]);
    child.stdin.end();
    await Promise.all([encrypted(child.stdout, "storage.tar.gz.enc"), done]);
    await writeFile(
      path.join(directory, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      { mode: 0o600 },
    );
    console.log(
      `Encrypted assets backup created: ${path.relative(root, directory)}. Keep its key separately.`,
    );
  }
} finally {
  await closeDatabase();
}
