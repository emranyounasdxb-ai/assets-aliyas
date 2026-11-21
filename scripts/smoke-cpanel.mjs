import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { setTimeout as pause } from "node:timers/promises";

const directory = path.resolve("dist/cpanel");
const manifest = JSON.parse(
  await readFile(path.join(directory, "deploy-manifest.json"), "utf8"),
);
assert.ok(manifest.verificationOnly && process.env.GITHUB_ACTIONS === "true");
const child = spawn(process.execPath, ["app.cjs"], {
  cwd: directory,
  env: {
    ...process.env,
    HOSTNAME: "127.0.0.1",
    PORT: "3210",
    SUPABASE_SECRET_KEY: "ci-runtime-verification-only",
    CLAMAV_HOST: "127.0.0.1",
    CLAMAV_PORT: "56331",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let stderr = "";
child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
child.stdout.resume();
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null)
      throw new Error(`Packaged server exited: ${stderr}`);
    try {
      const response = await fetch("http://127.0.0.1:3210/api/health");
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await pause(500);
  }
  assert.ok(ready, `Packaged server did not start: ${stderr}`);
  const login = await fetch("http://127.0.0.1:3210/login");
  assert.equal(login.status, 200);
  const html = await login.text();
  assert.ok(html.includes("Sign in"));
  assert.ok(!html.includes("Explore demo workspace"));
  for (const asset of ["/favicon.ico", "/brand/aliyas-gold.webp"]) {
    assert.equal((await fetch(`http://127.0.0.1:3210${asset}`)).status, 200);
  }
  assert.equal(
    (await fetch("http://127.0.0.1:3210/api/workspace")).status,
    401,
  );
  const require = createRequire(path.join(directory, "server.js"));
  const sharp = require("sharp");
  const converted = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "white" },
  })
    .webp()
    .toBuffer();
  assert.ok(converted.length > 0);
  console.log(
    "Linux package startup, private route protection, native image processing and assets verified.",
  );
} finally {
  child.kill("SIGTERM");
}
