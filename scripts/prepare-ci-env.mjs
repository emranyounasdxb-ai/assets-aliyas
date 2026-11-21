import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";

assert.equal(
  process.env.GITHUB_ACTIONS,
  "true",
  "Use this only on the disposable CI runner",
);
const config = JSON.parse(
  execFileSync(
    process.execPath,
    ["node_modules/supabase/dist/supabase.js", "status", "-o", "json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ),
);
assert.equal(new URL(config.API_URL).hostname, "127.0.0.1");
const password = randomBytes(32).toString("base64url");
for (const value of [
  config.SECRET_KEY,
  config.SERVICE_ROLE_KEY,
  config.JWT_SECRET,
  password,
].filter(Boolean))
  console.log(`::add-mask::${value}`);
assert.ok(
  config.PUBLISHABLE_KEY && config.SECRET_KEY,
  "Local backend keys are missing",
);
await writeFile(
  ".env.local",
  [
    `NEXT_PUBLIC_SUPABASE_URL=${config.API_URL}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${config.PUBLISHABLE_KEY}`,
    `SUPABASE_SECRET_KEY=${config.SECRET_KEY}`,
    "APP_ORIGIN=http://127.0.0.1:3200",
    "LOCAL_DEMO=true",
    "DEMO_EMAIL=ci-demo@aliyas.example.test",
    `DEMO_PASSWORD=${password}`,
    "CLAMAV_HOST=127.0.0.1",
    "CLAMAV_PORT=56331",
    "",
  ].join("\n"),
  { mode: 0o600 },
);
console.log("Disposable local CI environment prepared.");
