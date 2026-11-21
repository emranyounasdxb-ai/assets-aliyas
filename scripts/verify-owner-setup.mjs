import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { databasePool, one, sql, closeDatabase } from "../database/sql.mjs";
import { verifyPassword } from "../database/passwords.mjs";

assert.equal(process.env.GITHUB_ACTIONS, "true", "Disposable CI database only");
assert.equal(new URL(process.env.DATABASE_URL).pathname, "/aliyas_assets");
const pool = databasePool();
assert.equal((await one(pool, "select count(*) total from users")).total, 0);
assert.equal(
  (await one(pool, "select count(*) total from workspaces")).total,
  0,
);
const password = randomBytes(8).toString("base64url").slice(0, 10);
console.log(`::add-mask::${password}`);
async function runSetup(answers) {
  const child = spawn(
    "script",
    ["-qec", "node scripts/setup-owner.mjs", "/dev/null"],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  let output = "";
  let next = 0;
  const timer = setTimeout(() => child.kill("SIGKILL"), 60000);
  const prompts = [
    "Admin name: ",
    "Admin email: ",
    "characters, hidden): ",
    "Confirm password (hidden): ",
  ];
  child.stderr.on("data", (chunk) => (output += chunk.toString()));
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
    if (next < answers.length && output.includes(prompts[next])) {
      child.stdin.write(`${answers[next++]}\n`);
    }
  });
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  }).finally(() => clearTimeout(timer));
  assert.ok(!output.includes(password), "The private password was echoed");
  return { code, output };
}
let owner;
let workspace;
try {
  const tooShort = await runSetup([
    "CI setup fixture",
    "ci-owner@aliyas.example.test",
    password.slice(0, 9),
  ]);
  assert.notEqual(tooShort.code, 0);
  assert.ok(tooShort.output.includes("Use a password of 10-200 characters"));
  assert.ok(
    !tooShort.output.includes(password.slice(0, 9)),
    "The rejected password was echoed",
  );
  assert.equal((await one(pool, "select count(*) total from users")).total, 0);
  const result = await runSetup([
    "CI setup fixture",
    "ci-owner@aliyas.example.test",
    password,
    password,
  ]);
  assert.equal(result.code, 0, "Private terminal setup failed");
  owner = await one(pool, "select * from users where email=?", [
    "ci-owner@aliyas.example.test",
  ]);
  assert.ok(owner);
  assert.ok(await verifyPassword(password, owner.password_hash));
  const membership = await one(
    pool,
    "select * from memberships where user_id=?",
    [owner.id],
  );
  workspace = membership.workspace_id;
  assert.equal(membership.role, "owner");
  assert.equal(
    (
      await one(
        pool,
        "select count(*) total from buildings where workspace_id=?",
        [workspace],
      )
    ).total,
    9,
  );
  assert.equal(
    (
      await one(
        pool,
        "select count(*) total from floors where workspace_id=?",
        [workspace],
      )
    ).total,
    68,
  );
  const retry = await runSetup([]);
  assert.notEqual(retry.code, 0);
  assert.ok(retry.output.includes("Owner setup is closed"));
  assert.equal((await one(pool, "select count(*) total from users")).total, 1);
  console.log(
    "Private owner setup, hidden password, confirmed inventory and closed repeat setup verified.",
  );
} finally {
  if (workspace) {
    for (const table of ["floors", "buildings", "memberships"])
      await sql(pool, `delete from ${table} where workspace_id=?`, [workspace]);
    await sql(pool, "delete from workspaces where id=?", [workspace]);
  }
  if (owner) await sql(pool, "delete from users where id=?", [owner.id]);
  await closeDatabase();
}
