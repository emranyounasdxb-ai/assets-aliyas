import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
assert.equal(process.env.GITHUB_ACTIONS, "true", "Disposable CI only");
const password = randomBytes(32).toString("base64url");
const databasePassword = randomBytes(32).toString("base64url");
for (const value of [password, databasePassword])
  console.log(`::add-mask::${value}`);
await writeFile(
  ".env.local",
  [
    `DATABASE_URL=mysql://root:${databasePassword}@127.0.0.1:56332/aliyas_assets`,
    `MARIADB_ROOT_PASSWORD=${databasePassword}`,
    `PRIVATE_STORAGE_DIR=${path.resolve(".private-files")}`,
    "APP_ORIGIN=http://127.0.0.1:3200",
    "LOCAL_DEMO=true",
    "DEMO_EMAIL=ci-demo@aliyas.example.test",
    `DEMO_PASSWORD=${password}`,
    "CLAMAV_HOST=127.0.0.1",
    "CLAMAV_PORT=56331",
    "",
  ].join(String.fromCharCode(10)),
  { mode: 0o600 },
);
console.log("Disposable MariaDB CI environment prepared.");
