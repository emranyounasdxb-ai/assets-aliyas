const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");

const realDocker = process.env.ALIYAS_REAL_DOCKER;
assert.ok(
  realDocker,
  "The project Docker launcher requires its real Docker path",
);
const args = process.argv.slice(2);
const nameIndex = args.indexOf("--name");
const containerName = nameIndex >= 0 ? args[nameIndex + 1] : "";

if (
  (args.includes("create") || args.includes("run")) &&
  /^supabase_[a-z_]+_assets-aliyas$/.test(containerName)
) {
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== "-p" && args[index] !== "--publish") continue;
    const binding = args[index + 1];
    assert.ok(binding, "Missing Docker port binding");
    if (/^\d+:\d+(?:\/(?:tcp|udp))?$/.test(binding)) {
      args[index + 1] = `127.0.0.1:${binding}`;
    } else {
      assert.ok(
        binding.startsWith("127.0.0.1:"),
        "Refusing a port outside localhost",
      );
    }
    index += 1;
  }
}

const result = spawnSync(realDocker, args, {
  stdio: "inherit",
  windowsHide: true,
});
if (result.error) {
  console.error("The project Docker launcher could not start Docker.");
  process.exit(1);
}
process.exit(result.status ?? 1);
