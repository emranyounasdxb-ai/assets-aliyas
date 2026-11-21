import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

await import("./prepare-local-env.mjs");
process.loadEnvFile(".env.local");
assert.ok(
  ["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  ),
  "Local services only",
);
const compose = [
  "compose",
  "--env-file",
  ".env.local",
  "-f",
  "compose.services.yaml",
  "up",
  "-d",
  "--wait",
];
const result = spawnSync("docker", compose, {
  stdio: "inherit",
  windowsHide: true,
});
if (result.status !== 0) process.exit(result.status || 1);
console.log(
  "Project MariaDB and scanner started on localhost. Existing containers and volumes preserved.",
);
