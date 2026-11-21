import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
await mkdir(".tools", { recursive: true });
let existing = "";
try {
  existing = await readFile(".env.local", "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (!/^DATABASE_URL=/m.test(existing)) {
  assert.ok(
    !/^NEXT_PUBLIC_/m.test(existing),
    "Migrate existing local data before replacing its backend settings",
  );
  const password = randomBytes(36).toString("base64url");
  const demo = randomBytes(32).toString("base64url");
  await writeFile(
    ".env.local",
    [
      existing,
      `DATABASE_URL=mysql://root:${password}@127.0.0.1:56332/aliyas_assets`,
      `MARIADB_ROOT_PASSWORD=${password}`,
      `PRIVATE_STORAGE_DIR=${path.resolve(".private-files").replaceAll("\\", "/")}`,
      "APP_ORIGIN=http://127.0.0.1:3200",
      "LOCAL_DEMO=true",
      "DEMO_EMAIL=portfolio-demo@aliyas.example.test",
      `DEMO_PASSWORD=${demo}`,
      "CLAMAV_HOST=127.0.0.1",
      "CLAMAV_PORT=56331",
      "",
    ].join(String.fromCharCode(10)),
    { mode: 0o600 },
  );
  console.log("Private local MariaDB settings prepared.");
} else console.log("Existing local database settings preserved.");
