import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as pause } from "node:timers/promises";

// Run outside the checkout so missing dependencies cannot resolve from the
// development node_modules and hide an incomplete deployment package.
const directory = await mkdtemp(path.join(tmpdir(), "aliyas-cpanel-"));
await cp(path.resolve("dist/cpanel"), directory, {
  recursive: true,
  dereference: false,
  verbatimSymlinks: true,
});
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
    DATABASE_URL: "mysql://ci:ci@127.0.0.1:56332/ci_verification",
    PRIVATE_STORAGE_DIR: path.resolve(".private-files"),
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
  assert.equal(typeof require("mysql2/promise").createPool, "function");
  assert.equal(typeof require("date-fns").addMonths, "function");
  const maintenance = await import(
    pathToFileURL(path.join(directory, "database/client.mjs")).href
  );
  assert.equal(typeof maintenance.adminDatabase, "function");
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
  await new Promise((resolve) => {
    if (child.exitCode !== null) resolve();
    else child.once("exit", resolve);
  });
  await rm(directory, { recursive: true, force: true });
}
