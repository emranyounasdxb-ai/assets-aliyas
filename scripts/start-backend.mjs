import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { prepareDockerEnvironment } from "./prepare-docker.mjs";

const networkName = "assets-aliyas-local";
const cliPath = fileURLToPath(
  new URL("../node_modules/supabase/dist/supabase.js", import.meta.url),
);

function docker(args) {
  const result = spawnSync("docker", args, { encoding: "utf8" });
  if (result.error) throw result.error;
  return result;
}

let network = docker(["network", "inspect", networkName]);
if (network.status !== 0) {
  const created = docker([
    "network",
    "create",
    "--driver",
    "bridge",
    "--opt",
    "com.docker.network.bridge.host_binding_ipv4=127.0.0.1",
    networkName,
  ]);
  assert.equal(created.status, 0, created.stderr);
  network = docker(["network", "inspect", networkName]);
}
assert.equal(network.status, 0, network.stderr);
assert.equal(
  JSON.parse(network.stdout)[0].Options[
    "com.docker.network.bridge.host_binding_ipv4"
  ],
  "127.0.0.1",
  "The project Docker network must publish ports on localhost",
);

const dockerEnvironment = await prepareDockerEnvironment();
const started = spawnSync(
  process.execPath,
  [cliPath, "start", "--network-id", networkName],
  { stdio: "inherit", env: dockerEnvironment },
);
if (started.error) throw started.error;
if (started.status !== 0) process.exit(started.status ?? 1);

const containers = docker([
  "ps",
  "--filter",
  "name=assets-aliyas",
  "--format",
  "{{.Names}}",
]);
assert.equal(containers.status, 0, containers.stderr);

try {
  const projectContainers = containers.stdout
    .trim()
    .split(/\r?\n/)
    .filter(
      (name) => name.startsWith("supabase_") && name.endsWith("_assets-aliyas"),
    );
  assert.ok(
    projectContainers.includes("supabase_db_assets-aliyas"),
    "The project database is missing",
  );
  for (const name of projectContainers) {
    const ports = docker([
      "inspect",
      "--format",
      "{{json .NetworkSettings.Ports}}",
      name,
    ]);
    assert.equal(ports.status, 0, ports.stderr);
    for (const bindings of Object.values(JSON.parse(ports.stdout))) {
      for (const binding of bindings ?? []) {
        assert.ok(
          ["127.0.0.1", "::1"].includes(binding.HostIp),
          `${name} published a port outside localhost`,
        );
      }
    }
  }
} catch (error) {
  spawnSync(process.execPath, [cliPath, "stop"], { stdio: "inherit" });
  throw error;
}

console.log(
  "Local backend verified: published ports are restricted to localhost.",
);
