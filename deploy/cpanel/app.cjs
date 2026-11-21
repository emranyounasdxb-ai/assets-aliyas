const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const manifest = require("./deploy-manifest.json");

assert.equal(
  Number(process.versions.node.split(".")[0]),
  26,
  "This release requires Node.js 26 LTS",
);
assert.ok(
  !manifest.verificationOnly || process.env.GITHUB_ACTIONS === "true",
  "CI verification packages cannot be deployed",
);
assert.equal(
  process.env.APP_ORIGIN,
  manifest.appOrigin,
  "APP_ORIGIN must match this build's HTTPS subdomain",
);
assert.equal(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  manifest.supabaseUrl,
  "Rebuild after changing the public backend URL",
);
assert.equal(
  createHash("sha256")
    .update(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "")
    .digest("hex"),
  manifest.publishableKeyHash,
  "The runtime publishable key must match this build",
);
for (const name of ["SUPABASE_SECRET_KEY", "CLAMAV_HOST", "CLAMAV_PORT"])
  assert.ok(process.env[name], `${name} must be configured in cPanel`);
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
// Passenger binds the first HTTP server; Next's generated entry owns that server.
import("./server.js").catch((error) => {
  console.error("Application startup failed:", error.message);
  process.exitCode = 1;
});
