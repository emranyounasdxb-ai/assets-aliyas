import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function prepareDockerEnvironment() {
  const projectRoot = fileURLToPath(new URL("../", import.meta.url));
  const located = spawnSync(
    process.platform === "win32" ? "where.exe" : "which",
    [process.platform === "win32" ? "docker.exe" : "docker"],
    { encoding: "utf8" },
  );
  assert.equal(located.status, 0, "Docker must be installed and available");
  const realDocker = located.stdout.trim().split(/\r?\n/)[0];
  const sourcePath = path.join(projectRoot, "scripts/docker-loopback.cjs");
  const shimRoot = path.join(projectRoot, ".tools/docker-loopback");
  const shimPath = path.join(
    shimRoot,
    process.platform === "win32" ? "docker.exe" : "docker",
  );
  const hashPath = path.join(shimRoot, "source.sha256");
  const sourceHash = createHash("sha256")
    .update(await readFile(sourcePath))
    .update(process.version)
    .digest("hex");
  let installedHash;
  try {
    await access(shimPath);
    installedHash = await readFile(hashPath, "utf8");
  } catch {
    installedHash = undefined;
  }
  if (installedHash !== sourceHash) {
    await mkdir(shimRoot, { recursive: true });
    const configPath = path.join(shimRoot, "sea-config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        main: sourcePath,
        output: shimPath,
        disableExperimentalSEAWarning: true,
      }),
    );
    const built = spawnSync(process.execPath, ["--build-sea", configPath], {
      encoding: "utf8",
    });
    assert.equal(built.status, 0, "Could not build the local Docker launcher");
    await writeFile(hashPath, sourceHash);
  }

  const environment = {
    ...process.env,
    PATH: `${shimRoot}${path.delimiter}${process.env.PATH}`,
    ALIYAS_REAL_DOCKER: realDocker,
  };
  const probe = spawnSync(shimPath, ["--version"], {
    env: environment,
    encoding: "utf8",
  });
  assert.equal(probe.status, 0, "The local Docker launcher failed its check");
  assert.match(probe.stdout, /Docker version/);
  return environment;
}
