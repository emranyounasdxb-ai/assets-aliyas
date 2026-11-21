import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { appendFile } from "node:fs/promises";
import { adminDatabase, DatabaseClient } from "../database/client.mjs";
import { closeDatabase } from "../database/sql.mjs";

const backend = process.env.DATABASE_URL;
assert.ok(
  backend && ["127.0.0.1", "localhost"].includes(new URL(backend).hostname),
  "Demo bootstrap is restricted to a local backend",
);
const admin = adminDatabase();
const email = process.env.DEMO_EMAIL ?? "portfolio-demo@aliyas.example.test";
const password =
  process.env.DEMO_PASSWORD ?? randomBytes(30).toString("base64url");
const checked = async (promise) => {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data;
};
const { data: users, error: usersError } = await admin.auth.admin.listUsers();
if (usersError) throw usersError;
let user = users.users.find((u) => u.email === email);
if (!user) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Emran Younas" },
  });
  if (error) throw error;
  user = data.user;
}
assert.ok(user);
if (!process.env.DEMO_PASSWORD)
  await appendFile(
    ".env.local",
    `\nLOCAL_DEMO=true\nDEMO_EMAIL=${email}\nDEMO_PASSWORD=${password}\nCLAMAV_HOST=127.0.0.1\nCLAMAV_PORT=56331\nAPP_ORIGIN=http://127.0.0.1:3200\n`,
  );
const { data: existing } = await admin
  .from("memberships")
  .select("workspace_id")
  .eq("user_id", user.id)
  .limit(1)
  .maybeSingle();
if (existing) {
  console.log(
    "Local demo account already exists; existing portfolio preserved.",
  );
  process.exit(0);
}
const workspace = await checked(
  admin
    .from("workspaces")
    .insert({
      name: "Aliyas demo portfolio",
      is_demo: true,
      address: "Ajman, United Arab Emirates",
    })
    .select("*")
    .single(),
);
await checked(
  admin.from("memberships").insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: "owner",
    display_name: "Emran Younas",
  }),
);
const client = new DatabaseClient();
const { error: loginError } = await client.auth.signInWithPassword({
  email,
  password,
});
if (loginError) throw loginError;
const properties = [
  ["Al Noor Residence", "ANR", "Al Nuaimiya", "sage"],
  ["Al Yasmeen Tower", "AYT", "Al Yasmeen", "sand"],
  ["Al Rawda Heights", "ARH", "Al Rawda", "slate"],
  ["Creekside Residence", "CSR", "Al Rashidiya", "sage"],
  ["Al Jurf Residency", "AJR", "Al Jurf", "rose"],
  ["Garden Court", "GCT", "Al Mowaihat", "sand"],
  ["Al Nuaimiya Plaza", "ANP", "Al Nuaimiya", "slate"],
  ["Palm Residence", "PMR", "Al Rashidiya", "sage"],
  ["Al Rashidiya Court", "ARC", "Al Rashidiya", "rose"],
];
const firstNames = [
  "Omar",
  "Ahmed",
  "Sara",
  "Bilal",
  "Ayesha",
  "Faisal",
  "Nadia",
  "Khalid",
  "Maryam",
  "Hassan",
  "Fatima",
  "Zain",
  "Amna",
  "Tariq",
  "Leena",
  "Yusuf",
  "Hina",
  "Adnan",
];
const lastNames = ["Rashid", "Khan", "Ali", "Hassan", "Malik", "Saeed"];
const banks = ["Emirates NBD", "ADCB", "Dubai Islamic Bank", "Mashreq"];
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Dubai",
}).format(new Date());
const [year, month] = today.split("-").map(Number);
let tenantIndex = 0;
for (let b = 0; b < properties.length; b++) {
  const [name, code, area, color] = properties[b];
  const buildingId = await checked(
    client.rpc("create_building", {
      w: workspace.id,
      p: {
        name,
        code,
        area,
        color,
        address: `${area}, Ajman`,
        amenities: ["Parking", "Central AC", "Security", "Elevator"],
        notes: "Fictional property for the local demonstration.",
      },
      floor_count: b % 3 === 0 ? 2 : 3,
    }),
  );
  const floors = await checked(
    client
      .from("floors")
      .select("*")
      .eq("building_id", buildingId)
      .order("ordinal"),
  );
  for (const floor of floors) {
    for (let n = 1; n <= 4; n++) {
      const category = ["Studio", "1 BHK", "2 BHK", "3 BHK"][(n + b) % 4];
      const monthly =
        ([1750, 2450, 3350, 4350][
          ["Studio", "1 BHK", "2 BHK", "3 BHK"].indexOf(category)
        ] +
          (b % 4) * 125 +
          (n % 2) * 75) *
        100;
      const unit = await checked(
        client
          .from("units")
          .insert({
            workspace_id: workspace.id,
            building_id: buildingId,
            floor_id: floor.id,
            code: floor.ordinal === 0 ? `G0${n}` : `${floor.ordinal}0${n}`,
            category,
            monthly_rent: monthly,
            area_sqft: {
              Studio: 460,
              "1 BHK": 780,
              "2 BHK": 1140,
              "3 BHK": 1580,
            }[category],
            amenities:
              n % 2 === 0
                ? ["Parking", "Balcony", "Central AC"]
                : ["Central AC"],
            status: b === 7 && n === 4 ? "maintenance" : "available",
          })
          .select("*")
          .single(),
      );
      if ((n + floor.ordinal + b) % 5 === 0 || unit.status === "maintenance")
        continue;
      const i = tenantIndex++;
      const fullName = `${firstNames[i % firstNames.length]} ${lastNames[Math.floor(i / firstNames.length) % lastNames.length]}`;
      const tenantId = await checked(
        client.rpc("create_tenant", {
          w: workspace.id,
          details: {
            name: fullName,
            email: `tenant${i + 1}@example.test`,
            phone: "Demo contact",
            nationality: [
              "Pakistan",
              "India",
              "United Arab Emirates",
              "Jordan",
              "Philippines",
            ][i % 5],
            notes: "Fictional tenant. No real identity documents.",
          },
          opening: i % 13 === 0 ? 27500 : 0,
        }),
      );
      const checks = i % 3 === 0 ? 6 : 4;
      const start = new Date(
        Date.UTC(year, month - 1 - (checks === 6 ? 6 : 3), 24 + (i % 5)),
      )
        .toISOString()
        .slice(0, 10);
      const ref = `AY-${year}-${String(i + 1).padStart(4, "0")}`;
      const leaseId = await checked(
        client.rpc("create_lease", {
          w: workspace.id,
          t: tenantId,
          u: unit.id,
          starts: start,
          rent: monthly * 12,
          checks,
          ref,
          bank_name: banks[i % banks.length],
          notes_text: "Sample annual tenancy record.",
        }),
      );
      const cheques = await checked(
        client
          .from("cheques")
          .select("*")
          .eq("lease_id", leaseId)
          .order("due_date"),
      );
      for (let c = 0; c < cheques.length; c++) {
        const cheque = cheques[c];
        if (cheque.due_date < today) {
          await checked(
            client.rpc("set_cheque_status", {
              c: cheque.id,
              new_status: "deposited",
              on_date: cheque.due_date,
              new_number: String(470001 + i * 6 + c),
            }),
          );
          await checked(
            client.rpc("set_cheque_status", {
              c: cheque.id,
              new_status:
                i % 17 === 0 &&
                c === cheques.filter((q) => q.due_date < today).length - 1
                  ? "bounced"
                  : "cleared",
              on_date: cheque.due_date,
            }),
          );
        }
      }
      if (i % 3 === 0)
        await checked(
          client.rpc("add_security", {
            w: workspace.id,
            t: tenantId,
            amount_cents: 250000,
            ref: `SEC-${String(i + 1).padStart(4, "0")}`,
            is_cheque: true,
            bank_name: banks[i % banks.length],
          }),
        );
      else if (i % 4 === 0)
        await checked(
          client.rpc("add_security", {
            w: workspace.id,
            t: tenantId,
            amount_cents: 150000,
            ref: `Deposit ${String(i + 1).padStart(4, "0")}`,
            is_cheque: false,
          }),
        );
    }
  }
  console.log(`Seeded demo property ${b + 1}/${properties.length}.`);
}
console.log(
  `Demo portfolio ready: ${properties.length} fictional buildings and ${tenantIndex} fictional tenants. Credentials saved only in ignored .env.local.`,
);
await closeDatabase();
