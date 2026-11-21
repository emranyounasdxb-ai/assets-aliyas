const assert = require("node:assert/strict");
const path = require("node:path");
const manifest = require("./deploy-manifest.json");
if (process.env.ALIYAS_ENV_FILE) {
  const file = path.resolve(process.env.ALIYAS_ENV_FILE);
  assert.ok(
    path.isAbsolute(process.env.ALIYAS_ENV_FILE),
    "Use an absolute private environment path",
  );
  assert.ok(
    !file.startsWith(__dirname + path.sep) &&
      !file.split(path.sep).includes("public_html") &&
      !file.startsWith("/home/aliyasrealestate/assets.aliyasrealestate.ae/"),
    "Environment files must stay outside web and release directories",
  );
  process.loadEnvFile(file);
}
const [major, minor, patch] = process.versions.node.split(".").map(Number);
assert.ok(
  (major === 24 && (minor > 22 || (minor === 22 && patch >= 3))) ||
    (major === 26 && (minor > 13 || (minor === 13 && patch >= 1))),
  "This release requires supported Node.js 24.22.3+ or 26.13.1+ LTS",
);
assert.ok(
  !manifest.verificationOnly || process.env.GITHUB_ACTIONS === "true",
  "CI packages cannot be deployed",
);
assert.equal(
  process.env.APP_ORIGIN,
  manifest.appOrigin,
  "APP_ORIGIN must match the dedicated subdomain",
);
for (const name of [
  "DATABASE_URL",
  "PRIVATE_STORAGE_DIR",
  "CLAMAV_HOST",
  "CLAMAV_PORT",
])
  assert.ok(process.env[name], `${name} must be configured privately`);
const database = new URL(process.env.DATABASE_URL);
assert.equal(database.protocol, "mysql:");
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(database.hostname),
  "Use the existing database on this server",
);
assert.ok(
  manifest.verificationOnly || database.pathname === "/aliyasrealestate_assets",
  "Use only the isolated assets database",
);
assert.ok(
  path.isAbsolute(process.env.PRIVATE_STORAGE_DIR),
  "Private storage must have an absolute path",
);
assert.ok(
  !path
    .resolve(process.env.PRIVATE_STORAGE_DIR)
    .startsWith(__dirname + path.sep),
  "Store private files outside release directories",
);
assert.ok(
  !process.env.PRIVATE_STORAGE_DIR.split(/[\\/]/).includes("public_html"),
  "Private files cannot be stored in public_html",
);
assert.ok(
  Number.isInteger(Number(process.env.CLAMAV_PORT)) &&
    Number(process.env.CLAMAV_PORT) > 0 &&
    Number(process.env.CLAMAV_PORT) <= 65535,
  "Invalid scanner port",
);
process.env.NODE_ENV = "production";
process.env.LOCAL_DEMO = "false";
process.env.HOSTNAME ||= "127.0.0.1";
process.chdir(__dirname);
import("./server.js").catch((error) => {
  console.error("Application startup failed:", error.message);
  process.exitCode = 1;
});
