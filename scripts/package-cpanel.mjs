import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  readlink,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { deploymentSettings } from "./validate-deployment.mjs";

assert.equal(
  process.platform,
  "linux",
  "Create cPanel packages on the Linux CI runner, not Windows",
);
assert.equal(
  process.arch,
  "x64",
  "The current cPanel package targets Linux x64",
);
const verificationOnly = process.argv.includes("--verification");
assert.ok(
  !verificationOnly || process.env.GITHUB_ACTIONS === "true",
  "Verification packages are CI only",
);
const root = process.cwd();
const destination = path.resolve(root, "dist/cpanel");
assert.ok(destination.startsWith(path.resolve(root, "dist") + path.sep));
const { origin } = deploymentSettings(verificationOnly);
await readFile(".next/standalone/server.js");
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(".next/standalone", destination, {
  recursive: true,
  // pnpm links preserve the dependency's own resolution path. Flattening them
  // changes its ancestors and can hide required transitive packages.
  dereference: false,
  verbatimSymlinks: true,
  filter: (source) => !path.basename(source).startsWith(".env"),
});
await cp("public", path.join(destination, "public"), { recursive: true });
// Next optimizes date-fns into its server bundle. Maintenance scripts also use
// the unbundled package, so include its self-contained, pinned distribution.
const dates = path.join(destination, "node_modules/date-fns");
await rm(dates, { recursive: true, force: true });
await cp(await realpath("node_modules/date-fns"), dates, { recursive: true });
await cp(".next/static", path.join(destination, ".next/static"), {
  recursive: true,
});
await cp("deploy/cpanel/app.cjs", path.join(destination, "app.cjs"));
await cp(
  "deploy/cpanel/assets.htaccess.example",
  path.join(destination, "assets.htaccess.example"),
);
await cp("database", path.join(destination, "database"), { recursive: true });
await mkdir(path.join(destination, "scripts"), { recursive: true });
for (const script of [
  "migrate.mjs",
  "create-admin.mjs",
  "seed-portfolio.mjs",
  "reminders.mjs",
])
  await cp(
    path.join("scripts", script),
    path.join(destination, "scripts", script),
  );
await cp(
  "deploy/cpanel/.env.production.example",
  path.join(destination, ".env.production.example"),
);
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const manifest = {
  schemaVersion: 1,
  commit,
  node: process.versions.node,
  platform: "linux-x64",
  verificationOnly,
  appOrigin: origin.origin,
  databaseEngine: "MariaDB 10.11 / MySQL 8",
};
await writeFile(
  path.join(destination, "deploy-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
const secrets = [
  process.env.DATABASE_URL,
  process.env.MARIADB_ROOT_PASSWORD,
  process.env.DEMO_PASSWORD,
  process.env.BACKUP_ENCRYPTION_KEY,
  process.env.GH_TOKEN,
  process.env.GITHUB_TOKEN,
].filter((value) => value && value.length >= 16);
async function inspect(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, item.name);
    if (item.isSymbolicLink()) {
      const link = await readlink(full);
      assert.ok(!path.isAbsolute(link), "Package links must be relative");
      const target = await realpath(full);
      assert.ok(
        target.startsWith(destination + path.sep),
        "Package links must stay inside the release",
      );
      continue;
    }
    assert.ok(
      !item.name.startsWith(".env") || item.name === ".env.production.example",
      "A private environment file was copied",
    );
    if (item.isDirectory()) await inspect(full);
    else {
      const file = await readFile(full);
      for (const secret of secrets)
        assert.ok(
          !file.includes(Buffer.from(secret)),
          "A private credential was included in the package",
        );
    }
  }
}
await inspect(destination);
if (!verificationOnly) {
  const archive = path.resolve(
    root,
    `dist/aliyas-cpanel-${commit.slice(0, 12)}.tar.gz`,
  );
  execFileSync("tar", ["-czf", archive, "-C", destination, "."]);
  const hash = createHash("sha256")
    .update(await readFile(archive))
    .digest("hex");
  await writeFile(`${archive}.sha256`, `${hash}  ${path.basename(archive)}\n`);
}
console.log(
  `cPanel ${verificationOnly ? "verification" : "production"} package prepared for ${commit.slice(0, 12)}; no environment secrets included.`,
);
