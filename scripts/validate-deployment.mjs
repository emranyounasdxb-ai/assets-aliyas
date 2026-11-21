import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
export function deploymentSettings(verificationOnly = false) {
  assert.ok(
    !verificationOnly || process.env.GITHUB_ACTIONS === "true",
    "Verification packages are CI only",
  );
  const origin = new URL(process.env.APP_ORIGIN || "");
  assert.equal(origin.protocol, "https:");
  assert.ok(
    !origin.username && !origin.password && !origin.search && !origin.hash,
  );
  assert.equal(
    origin.origin,
    process.env.APP_ORIGIN,
    "Use an HTTPS origin without a path or trailing slash",
  );
  assert.equal(
    origin.hostname,
    "assets.aliyasrealestate.ae",
    "Use the dedicated assets subdomain",
  );
  return { origin };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  deploymentSettings();
  console.log("Deployment origin verified.");
}
