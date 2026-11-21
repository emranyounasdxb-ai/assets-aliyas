import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

export function deploymentSettings(verificationOnly = false) {
  assert.ok(
    !verificationOnly || process.env.GITHUB_ACTIONS === "true",
    "Verification packages are CI only",
  );
  const origin = new URL(process.env.APP_ORIGIN || "");
  const backend = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  for (const url of [origin, backend]) {
    assert.equal(url.protocol, "https:");
    assert.ok(!url.username && !url.password && !url.search && !url.hash);
    assert.ok(!["localhost", "127.0.0.1", "::1"].includes(url.hostname));
  }
  assert.equal(
    origin.origin,
    process.env.APP_ORIGIN,
    "Use an HTTPS origin without a path or trailing slash",
  );
  assert.equal(
    origin.hostname,
    "assets.aliyasrealestate.ae",
    "The planned deployment subdomain is assets.aliyasrealestate.ae",
  );
  assert.equal(
    backend.origin,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    "Use the backend HTTPS origin without a path or trailing slash",
  );
  assert.ok(key && !/\s/.test(key), "Configure the public publishable key");
  if (key.startsWith("eyJ")) {
    let role;
    try {
      role = JSON.parse(
        Buffer.from(key.split(".")[1], "base64url").toString(),
      ).role;
    } catch {}
    assert.equal(
      role,
      "anon",
      "Only the legacy anon key may be included in a public build",
    );
  } else
    assert.ok(
      key.startsWith("sb_publishable_"),
      "Never use a secret or service role key in a browser build",
    );
  if (!verificationOnly) {
    assert.ok(
      !backend.hostname.endsWith(".test") &&
        !backend.hostname.toLowerCase().includes("your_project"),
      "Configure the production backend before packaging",
    );
    assert.ok(
      !key.includes("ci_fixture"),
      "A CI fixture key cannot be deployed",
    );
  }
  return { origin, backend, key };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  deploymentSettings();
  console.log("Production public build settings verified.");
}
