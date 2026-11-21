import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const projectRoot = process.cwd();
const backend = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.ok(
  backend && ["127.0.0.1", "localhost"].includes(new URL(backend).hostname),
  "This backup command only supports the local project",
);
let encodedKey = process.env.BACKUP_ENCRYPTION_KEY;
const verify = process.argv[2] === "--verify";
if (!encodedKey) {
  assert.ok(!verify, "The original backup encryption key is required");
  encodedKey = randomBytes(32).toString("base64");
  await appendFile(".env.local", `\nBACKUP_ENCRYPTION_KEY=${encodedKey}\n`);
}
const key = Buffer.from(encodedKey, "base64");
assert.equal(key.length, 32, "Backup encryption key must contain 32 bytes");
const specs = [
  {
    file: "database.dump.enc",
    container: "supabase_db_assets-aliyas",
    backup: [
      "pg_dump",
      "--username=postgres",
      "--dbname=postgres",
      "--format=custom",
      "--no-owner",
      "--no-acl",
    ],
    check: ["pg_restore", "--list"],
  },
  {
    file: "storage.tar.gz.enc",
    container: "supabase_storage_assets-aliyas",
    backup: ["tar", "-cz", "-C", "/mnt", "."],
    check: ["tar", "-tz"],
  },
];
function command(args, interactive = false) {
  const child = spawn(
    "docker",
    ["exec", ...(interactive ? ["-i"] : []), ...args],
    {
      stdio: [interactive ? "pipe" : "ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(undefined)
        : reject(new Error("The local archive command failed")),
    );
  });
  child.stderr.resume();
  return { child, done };
}
if (verify) {
  const folder = path.resolve(process.argv[3] ?? "");
  assert.ok(
    folder.startsWith(path.join(projectRoot, "backups") + path.sep),
    "Choose a backup inside this project's backups directory",
  );
  const manifest = JSON.parse(
    await readFile(path.join(folder, "manifest.json"), "utf8"),
  );
  assert.equal(manifest.project, "assets-aliyas");
  for (const spec of specs) {
    const entry = manifest.files.find((item) => item.file === spec.file);
    assert.ok(entry, "Backup entry is missing");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(entry.iv, "hex"),
    );
    decipher.setAuthTag(Buffer.from(entry.tag, "hex"));
    const { child, done } = command([spec.container, ...spec.check], true);
    child.stdout.resume();
    await Promise.all([
      pipeline(
        createReadStream(path.join(folder, spec.file)),
        decipher,
        child.stdin,
      ),
      done,
    ]);
  }
  console.log(
    "Backup authenticated, decrypted and archive formats verified. Live data was not changed.",
  );
} else {
  const id = new Date().toISOString().replaceAll(":", "-").replace(".", "-");
  const folder = path.join(projectRoot, "backups", id);
  await mkdir(folder, { recursive: true });
  const manifest = {
    project: "assets-aliyas",
    created_at: new Date().toISOString(),
    algorithm: "AES-256-GCM",
    files: [],
  };
  for (const spec of specs) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const { child, done } = command([spec.container, ...spec.backup]);
    await Promise.all([
      pipeline(
        child.stdout,
        cipher,
        createWriteStream(path.join(folder, spec.file), { flags: "wx" }),
      ),
      done,
    ]);
    manifest.files.push({
      file: spec.file,
      iv: iv.toString("hex"),
      tag: cipher.getAuthTag().toString("hex"),
    });
  }
  await writeFile(
    path.join(folder, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  console.log(`Encrypted database and file storage backup saved: ${folder}`);
  console.log(
    "Keep the BACKUP_ENCRYPTION_KEY separately before moving this backup.",
  );
}
