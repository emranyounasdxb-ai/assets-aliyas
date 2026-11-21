import { randomUUID } from "node:crypto";
import { tables } from "./schema.mjs";
import {
  atomic,
  databasePool,
  sql,
  one,
  insert,
  update,
  audit,
  normalize,
  identifier,
  dbError,
  fail,
} from "./sql.mjs";
import { hashPassword, verifyPassword } from "./passwords.mjs";
import { storeFile, listFiles, removeFiles } from "./storage.mjs";

const sensitive = ["users", "sessions", "login_attempts"];
export async function role(connection, user, workspace) {
  return (
    await one(
      connection,
      "select role from memberships where user_id=? and workspace_id=?",
      [user, workspace],
    )
  )?.role;
}
export async function permission(
  connection,
  client,
  workspace,
  finance = false,
  owner = false,
) {
  if (client.administrator) return;
  const value =
    client.userId && (await role(connection, client.userId, workspace));
  if (
    !(
      owner
        ? ["owner"]
        : finance
          ? ["owner", "manager", "accountant"]
          : ["owner", "manager"]
    ).includes(value)
  )
    fail("Your role does not allow this change");
}
export async function validateWrite(connection, table, row, previous = null) {
  if (table === "units") {
    const floor = await one(
      connection,
      "select * from floors where id=? and building_id=? and workspace_id=? for update",
      [row.floor_id, row.building_id, row.workspace_id],
    );
    if (!floor) fail("Choose a floor in this property");
    if (["parking", "service"].includes(floor.purpose))
      fail("Rental units cannot be added to parking or service floors");
    if (row.category === "Shop" && floor.ordinal !== 0)
      fail("Shops must be on the ground floor");
    if (
      previous &&
      (row.floor_id !== previous.floor_id ||
        row.building_id !== previous.building_id ||
        (row.category === "Shop") !== (previous.category === "Shop")) &&
      (await one(connection, "select id from leases where unit_id=? limit 1", [
        row.id,
      ]))
    )
      fail(
        "A unit with agreement history cannot change its property, floor or rental type",
      );
  }
  if (table === "floors" && previous) {
    if (
      ["parking", "service"].includes(row.purpose) &&
      (await one(connection, "select id from units where floor_id=? limit 1", [
        row.id,
      ]))
    )
      fail(
        "This floor has rental units. Move them before changing it to parking or services",
      );
    if (
      ["residential", "service"].includes(row.purpose) &&
      (await one(
        connection,
        "select id from parking_lots where floor_id=? limit 1",
        [row.id],
      ))
    )
      fail("This floor has parking lots. Move them before changing its use");
    if (
      row.ordinal !== 0 &&
      (await one(
        connection,
        "select id from units where floor_id=? and category='Shop' limit 1",
        [row.id],
      ))
    )
      fail("A floor with shops must remain the ground floor");
  }
  if (table === "parking_lots") {
    if (row.floor_id) {
      const floor = await one(
        connection,
        "select * from floors where id=? and building_id=? and workspace_id=? for update",
        [row.floor_id, row.building_id, row.workspace_id],
      );
      if (!floor || !["parking", "unspecified"].includes(floor.purpose))
        fail("Choose a parking level or an unclassified level");
    }
    if (
      previous &&
      ["number", "floor_id", "building_id", "status"].some(
        (key) => row[key] !== previous[key],
      ) &&
      (await one(
        connection,
        "select id from parking_allocations where lot_id=? and status='active' and end_date>=date(utc_timestamp()+interval 4 hour) limit 1",
        [row.id],
      ))
    )
      fail(
        "This space is reserved. Its number, location and availability cannot change during an active reservation",
      );
  }
}
class Query {
  constructor(client, table) {
    if (!tables[table] || sensitive.includes(table))
      throw new Error("Unknown application table");
    this.client = client;
    this.table = table;
    this.filters = [];
    this.sort = [];
    this.fields = "*";
    this.operation = "select";
    this.offset = 0;
    this.maximum = 1000;
    this.mode = "many";
  }
  select(fields = "*") {
    this.fields = fields;
    return this;
  }
  eq(column, value) {
    this.filters.push([column, "=", value]);
    return this;
  }
  neq(column, value) {
    this.filters.push([column, "<>", value]);
    return this;
  }
  in(column, value) {
    this.filters.push([column, "in", value]);
    return this;
  }
  order(column, options = {}) {
    this.sort.push([column, options.ascending !== false]);
    return this;
  }
  limit(value) {
    this.maximum = value;
    return this;
  }
  range(start, end) {
    this.offset = start;
    this.maximum = end - start + 1;
    return this;
  }
  single() {
    this.mode = "one";
    return this;
  }
  maybeSingle() {
    this.mode = "optional";
    return this;
  }
  insert(value) {
    this.operation = "insert";
    this.value = value;
    return this;
  }
  upsert(value, options = {}) {
    this.operation = "insert";
    this.value = value;
    this.ignoreDuplicates = options.ignoreDuplicates;
    return this;
  }
  update(value) {
    this.operation = "update";
    this.value = value;
    return this;
  }
  delete() {
    this.operation = "delete";
    return this;
  }
  column(name) {
    if (
      !["id", "created_at", ...Object.keys(tables[this.table])].includes(name)
    )
      throw new Error("Unknown column");
    return identifier(name);
  }
  where() {
    const clauses = [];
    const values = [];
    for (const [column, operator, value] of this.filters) {
      const field = `t.${this.column(column)}`;
      if (operator === "in") {
        clauses.push(
          value.length
            ? `${field} in (${value.map(() => "?").join(",")})`
            : "false",
        );
        values.push(...value);
      } else if (value === null)
        clauses.push(`${field} is ${operator === "=" ? "" : "not "}null`);
      else {
        clauses.push(`${field}${operator}?`);
        values.push(value);
      }
    }
    if (!this.client.administrator) {
      if (!this.client.userId) clauses.push("false");
      else if (this.table === "notification_reads") {
        clauses.push("t.user_id=?");
        values.push(this.client.userId);
      } else {
        const workspace = this.table === "workspaces" ? "id" : "workspace_id";
        clauses.push(
          `exists(select 1 from memberships m where m.workspace_id=t.${workspace} and m.user_id=?)`,
        );
        values.push(this.client.userId);
        if (this.table === "documents") {
          clauses.push(
            "(exists(select 1 from memberships m where m.workspace_id=t.workspace_id and m.user_id=? and m.role in ('owner','manager','accountant')) or (t.target_type in ('building','floor','unit') and t.category in ('Photo','Floor plan')))",
          );
          values.push(this.client.userId);
        }
      }
    }
    return {
      clause: clauses.length ? ` where ${clauses.join(" and ")}` : "",
      values,
    };
  }
  async execute() {
    try {
      const { clause, values } = this.where();
      let result;
      if (this.operation === "select") {
        const fields =
          this.fields === "*"
            ? "t.*"
            : this.fields
                .split(",")
                .map((key) => `t.${this.column(key.trim())}`)
                .join(",");
        const order = this.sort.length
          ? ` order by ${this.sort.map(([key, ascending]) => `t.${this.column(key)} ${ascending ? "asc" : "desc"}`).join(",")}`
          : "";
        if (
          !Number.isInteger(this.maximum) ||
          !Number.isInteger(this.offset) ||
          this.maximum < 0 ||
          this.maximum > 10000 ||
          this.offset < 0
        )
          throw new Error("Invalid record page");
        result = await sql(
          databasePool(),
          `select ${fields} from ${identifier(this.table)} t${clause}${order} limit ${this.maximum} offset ${this.offset}`,
          values,
        );
      } else {
        const payload = Array.isArray(this.value) ? this.value : [this.value];
        const workspace =
          this.table === "workspaces"
            ? this.filters.find(([key]) => key === "id")?.[2]
            : this.filters.find(([key]) => key === "workspace_id")?.[2] ||
              payload[0]?.workspace_id;
        // Resolve the workspace before the transaction for updates that identify only id.
        const existingWorkspace =
          !workspace &&
          this.filters.find(([key]) => key === "id") &&
          Object.hasOwn(tables[this.table], "workspace_id")
            ? await one(
                databasePool(),
                `select workspace_id from ${identifier(this.table)} where id=?`,
                [this.filters.find(([key]) => key === "id")[2]],
              )
            : null;
        result = await atomic(
          workspace || existingWorkspace?.workspace_id,
          async (connection) => {
            const written = [];
            if (this.operation === "insert") {
              for (const item of payload) {
                if (!item) continue;
                await this.authorize(connection, item);
                const row = { id: randomUUID(), ...item };
                await validateWrite(connection, this.table, row);
                try {
                  await insert(connection, this.table, row);
                  await audit(
                    connection,
                    this.table,
                    row,
                    this.client.userId,
                    "insert",
                  );
                  written.push(row);
                } catch (error) {
                  if (!this.ignoreDuplicates || error.code !== "ER_DUP_ENTRY")
                    throw error;
                }
              }
            } else {
              if (!this.filters.length) fail("A record filter is required");
              const rows = await sql(
                connection,
                `select t.* from ${identifier(this.table)} t${clause} for update`,
                values,
              );
              for (const previous of rows) {
                await this.authorize(connection, previous);
                if (this.operation === "delete") {
                  if (!this.client.administrator)
                    fail("Deletion is not allowed");
                  await sql(
                    connection,
                    `delete from ${identifier(this.table)} where id=?`,
                    [previous.id],
                  );
                  written.push(previous);
                } else {
                  if (
                    this.value.workspace_id &&
                    this.value.workspace_id !== previous.workspace_id
                  )
                    fail("Workspace cannot be changed");
                  const row = { ...previous, ...this.value };
                  await validateWrite(connection, this.table, row, previous);
                  await update(connection, this.table, previous.id, this.value);
                  await audit(
                    connection,
                    this.table,
                    row,
                    this.client.userId,
                    "update",
                  );
                  written.push(row);
                }
              }
            }
            // Read defaults and generated values back from MariaDB.
            if (!written.length) return [];
            if (this.operation === "delete") return written;
            return sql(
              connection,
              `select * from ${identifier(this.table)} where id in (${written.map(() => "?").join(",")})`,
              written.map((row) => row.id),
            );
          },
        );
      }
      const rows = normalize(result);
      const projected =
        this.fields === "*"
          ? rows
          : rows.map((row) =>
              Object.fromEntries(
                this.fields
                  .split(",")
                  .map((key) => [key.trim(), row[key.trim()]]),
              ),
            );
      if (this.mode === "one" && projected.length !== 1)
        fail("The record was not found");
      if (this.mode === "optional" && projected.length > 1)
        fail("More than one record matched");
      return {
        data: this.mode === "many" ? projected : projected[0] || null,
        error: null,
      };
    } catch (error) {
      return { data: null, error: dbError(error) };
    }
  }
  async authorize(connection, row) {
    if (this.client.administrator) return;
    if (this.table === "notification_reads") {
      if (row.user_id !== this.client.userId) fail("Access denied");
      const notice = await one(
        connection,
        "select workspace_id from notifications where id=?",
        [row.notification_id],
      );
      if (
        !notice ||
        !(await role(connection, this.client.userId, notice.workspace_id))
      )
        fail("Access denied");
      return;
    }
    if (
      ![
        "buildings",
        "floors",
        "units",
        "tenants",
        "parking_lots",
        "workspaces",
      ].includes(this.table)
    )
      fail("Use the approved account operation");
    await permission(
      connection,
      this.client,
      row.workspace_id || row.id,
      false,
      this.table === "workspaces",
    );
  }
  // biome-ignore lint/suspicious/noThenProperty: Queries intentionally implement PromiseLike for await.
  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
}
export class DatabaseClient {
  constructor(userId = null, administrator = false) {
    this.userId = userId;
    this.administrator = administrator;
    this.auth = {
      getUser: async () => ({
        data: {
          user: this.userId
            ? await one(
                databasePool(),
                "select id,email,display_name from users where id=? and disabled=false",
                [this.userId],
              )
            : null,
        },
        error: null,
      }),
      signInWithPassword: async ({ email, password }) => {
        const user = await one(
          databasePool(),
          "select * from users where email=? and disabled=false",
          [email.toLowerCase()],
        );
        if (!user || !(await verifyPassword(password, user.password_hash)))
          return {
            data: { user: null },
            error: { message: "Invalid credentials" },
          };
        this.userId = user.id;
        return {
          data: { user: { id: user.id, email: user.email } },
          error: null,
        };
      },
      signOut: async () => {
        this.userId = null;
        return { error: null };
      },
      admin: {
        listUsers: async () => {
          this.requireAdmin();
          return {
            data: {
              users: await sql(
                databasePool(),
                "select id,email,display_name from users",
              ),
            },
            error: null,
          };
        },
        createUser: async (value) => {
          try {
            this.requireAdmin();
            const id = await insert(databasePool(), "users", {
              id: value.id || randomUUID(),
              email: value.email.trim().toLowerCase(),
              password_hash: await hashPassword(value.password),
              display_name: value.user_metadata?.display_name || "",
            });
            return { data: { user: { id, email: value.email } }, error: null };
          } catch (error) {
            return { data: { user: null }, error: dbError(error) };
          }
        },
        deleteUser: async (id) => {
          this.requireAdmin();
          await sql(databasePool(), "delete from users where id=?", [id]);
          return { error: null };
        },
      },
    };
    this.storage = {
      from: () => ({
        upload: async (key, buffer) => {
          try {
            this.requireAdmin();
            await storeFile(key, buffer);
            return { error: null };
          } catch {
            return { error: { message: "Private storage unavailable" } };
          }
        },
        list: async (workspace) => {
          this.requireAdmin();
          return { data: await listFiles(workspace), error: null };
        },
        remove: async (keys) => {
          this.requireAdmin();
          await removeFiles(keys);
          return { error: null };
        },
      }),
    };
  }
  requireAdmin() {
    if (!this.administrator) fail("Server access required");
  }
  from(table) {
    return new Query(this, table);
  }
  async rpc(name, parameters) {
    try {
      const { operation } = await import("./operations.mjs");
      return { data: await operation(this, name, parameters), error: null };
    } catch (error) {
      return { data: null, error: dbError(error) };
    }
  }
}
export const adminDatabase = () => new DatabaseClient(null, true);
