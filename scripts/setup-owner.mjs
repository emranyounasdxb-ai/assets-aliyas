import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { Writable } from "node:stream";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { databasePool, one, sql, closeDatabase } from "../database/sql.mjs";

assert.ok(process.stdin.isTTY, "Run setup in the private hosting terminal");
assert.ok(
  ["/aliyasrealestate_assets", "/aliyas_assets"].includes(
    new URL(process.env.DATABASE_URL || "").pathname,
  ),
  "Use only the dedicated assets database",
);
let muted = false;
const output = new Writable({
  write(chunk, encoding, done) {
    if (!muted) process.stdout.write(chunk, encoding);
    done();
  },
});
const terminal = createInterface({
  input: process.stdin,
  output,
  terminal: true,
  historySize: 0,
});
const abort = new AbortController();
terminal.on("SIGINT", () => abort.abort());
async function ask(label, hidden = false) {
  muted = hidden;
  process.stdout.write(label);
  try {
    return await terminal.question("", { signal: abort.signal });
  } finally {
    if (hidden) process.stdout.write("\n");
    muted = false;
  }
}
const connection = await databasePool().getConnection();
let locked = false;
try {
  const lock = await one(
    connection,
    "select get_lock('aliyas.initial-owner',10) acquired",
  );
  assert.equal(lock.acquired, 1, "Another owner setup is running");
  locked = true;
  assert.equal(
    (await one(connection, "select count(*) total from users")).total,
    0,
    "Owner setup is closed: an account already exists",
  );
  const name = (await ask("Admin name: ")).trim();
  const email = (await ask("Admin email: ")).trim().toLowerCase();
  assert.ok(name && name.length <= 160, "Enter an admin name");
  assert.ok(
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 180,
    "Enter a valid admin email",
  );
  let password = await ask("Password (16-200 characters, hidden): ", true);
  assert.ok(
    password.length >= 16 && password.length <= 200,
    "Use a password of 16-200 characters",
  );
  assert.equal(
    password === (await ask("Confirm password (hidden): ", true)),
    true,
    "Passwords do not match",
  );
  // Child processes use separate database pools while this connection holds the
  // global setup lock. Credentials never enter shell arguments or a file.
  const env = { ...process.env, ADMIN_NAME: name, ADMIN_EMAIL: email };
  try {
    execFileSync(
      process.execPath,
      [fileURLToPath(new URL("./create-admin.mjs", import.meta.url))],
      {
        env: { ...env, ADMIN_PASSWORD: password },
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 120000,
      },
    );
  } finally {
    password = "";
  }
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL("./seed-portfolio.mjs", import.meta.url))],
    { env, stdio: ["ignore", "pipe", "pipe"], timeout: 120000 },
  );
  console.log(
    "Owner created. Initial setup is now closed. Sign in on the live site.",
  );
} catch (error) {
  console.error(
    error.status
      ? "Setup stopped. Check the dedicated assets database privately."
      : error.name === "AbortError"
        ? "Setup cancelled."
        : error.message,
  );
  process.exitCode = 1;
} finally {
  terminal.close();
  if (locked)
    await sql(connection, "select release_lock('aliyas.initial-owner')");
  connection.release();
  await closeDatabase();
}
