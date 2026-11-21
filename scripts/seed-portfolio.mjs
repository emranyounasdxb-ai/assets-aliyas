import assert from "node:assert/strict";
import { adminDatabase } from "../database/client.mjs";
import { atomic, one, sql, insert, closeDatabase } from "../database/sql.mjs";
const owner = process.env.ADMIN_EMAIL?.trim().toLowerCase();
assert.ok(owner, "Configure the owner email privately");
const admin = adminDatabase();
const { data: users } = await admin.auth.admin.listUsers();
const user = users.users.find((user) => user.email === owner);
assert.ok(user, "Create the owner first");
const { data: members, error } = await admin
  .from("memberships")
  .select("*")
  .eq("user_id", user.id);
assert.ok(
  !error && members.length === 1 && members[0].role === "owner",
  "Choose an owner with one workspace",
);
const workspace = members[0].workspace_id;
await atomic(workspace, async (connection) => {
  const data = await one(
    connection,
    "select is_demo from workspaces where id=?",
    [workspace],
  );
  assert.ok(
    !data.is_demo,
    "Do not import real inventory into a demo workspace",
  );
  if (
    await one(
      connection,
      "select id from buildings where workspace_id=? limit 1",
      [workspace],
    )
  ) {
    console.log(
      "Existing portfolio preserved; no buildings or floors were replaced.",
    );
    return;
  }
  for (let number = 11; number <= 19; number++) {
    const building = await insert(connection, "buildings", {
      workspace_id: workspace,
      name: `AG ${number}`,
      code: `AG${number}`,
      area: number === 19 ? "Al Mushref" : "Al Aliya",
      declared_levels: number === 19 ? 28 : 5,
    });
    const levels =
      number === 19
        ? [
            { name: "Ground floor", ordinal: 0, purpose: "unspecified" },
            ...Array.from({ length: 6 }, (_, i) => ({
              name: `Parking P${i + 1}`,
              ordinal: i + 1,
              purpose: "parking",
            })),
            ...Array.from({ length: 21 }, (_, i) => ({
              name: `Floor ${i + 1}`,
              ordinal: i + 7,
              purpose: i === 10 ? "service" : "residential",
            })),
          ]
        : Array.from({ length: 5 }, (_, i) => ({
            name: i === 0 ? "Ground floor" : `Floor ${i}`,
            ordinal: i,
            purpose: i === 0 ? "unspecified" : "residential",
          }));
    for (const level of levels)
      await insert(connection, "floors", {
        ...level,
        workspace_id: workspace,
        building_id: building,
        notes:
          number === 19 && level.name === "Floor 11"
            ? "Gym, services and kids play area. No apartments."
            : "",
      });
  }
  const rows = await sql(
    connection,
    "select count(*) total from floors where workspace_id=?",
    [workspace],
  );
  assert.equal(rows[0].total, 68);
  console.log(
    "Confirmed inventory added: 9 buildings and 68 physical levels. Shop, flat and parking lot numbers remain for user entry.",
  );
});
await closeDatabase();
