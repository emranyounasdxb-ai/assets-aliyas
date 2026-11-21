import assert from "node:assert/strict";
import { adminDatabase } from "../database/client.mjs";
import {
  databasePool,
  sql,
  closeDatabase,
  atomic,
  insert,
  one,
} from "../database/sql.mjs";
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const name = process.env.ADMIN_NAME?.trim();
const password = process.env.ADMIN_PASSWORD;
assert.ok(
  email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 180,
  "Configure ADMIN_EMAIL privately",
);
assert.ok(name && name.length <= 160, "Configure ADMIN_NAME privately");
assert.ok(
  password && password.length >= 16 && password.length <= 200,
  "Configure a private admin password of 16–200 characters",
);
const existing = await one(
  databasePool(),
  "select id from users where email=?",
  [email],
);
assert.ok(!existing, "This account already exists; no password was changed");
const admin = adminDatabase();
const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  user_metadata: { display_name: name },
});
if (error) throw new Error(error.message);
try {
  await atomic(null, async (connection) => {
    const workspace = await insert(connection, "workspaces", {
      name: "Aliyas Real Estate",
      is_demo: false,
    });
    await insert(connection, "memberships", {
      workspace_id: workspace,
      user_id: data.user.id,
      role: "owner",
      display_name: name,
    });
  });
  console.log(
    "Owner account and private assets workspace created. No password was printed.",
  );
} catch (error) {
  await sql(databasePool(), "delete from users where id=?", [data.user.id]);
  throw error;
} finally {
  await closeDatabase();
}
