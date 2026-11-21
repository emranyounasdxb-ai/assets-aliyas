import mysql from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { tables } from "./schema.mjs";
let pool;
export function databasePool() {
  if (!pool) {
    const url = new URL(process.env.DATABASE_URL || "");
    if (url.protocol !== "mysql:" || !url.pathname.slice(1))
      throw new Error("Configure the private MariaDB connection");
    pool = mysql.createPool({
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      connectionLimit: 8,
      queueLimit: 100,
      waitForConnections: true,
      timezone: "Z",
      dateStrings: true,
      decimalNumbers: true,
      multipleStatements: false,
      charset: "utf8mb4",
      connectTimeout: 10000,
    });
  }
  return pool;
}
export function fail(message, code = "P0001") {
  throw Object.assign(new Error(message), { code });
}
export function identifier(name) {
  if (!/^[a-z_][a-z0-9_]*$/.test(name))
    throw new Error("Invalid database identifier");
  return `\`${name}\``;
}
export async function sql(connection, statement, values = []) {
  const [rows] = await connection.execute(statement, values);
  return rows;
}
export async function one(connection, statement, values = []) {
  return (await sql(connection, statement, values))[0] || null;
}
export async function atomic(workspace, fn) {
  const connection = await databasePool().getConnection();
  try {
    await connection.beginTransaction();
    // All mutations serialize on their workspace row, including reservations and
    // payment retries. No process-local locks; every Passenger worker shares this.
    if (workspace)
      await sql(connection, "select id from workspaces where id=? for update", [
        workspace,
      ]);
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
export async function insert(connection, table, value) {
  if (!tables[table]) throw new Error("Unknown table");
  const row = { id: randomUUID(), ...value };
  const columns = Object.keys(row);
  for (const key of columns)
    if (!["id", "created_at", ...Object.keys(tables[table])].includes(key))
      throw new Error("Unknown column");
  const values = columns.map((key) => {
    const value = row[key];
    return Array.isArray(value) ||
      (value &&
        typeof value === "object" &&
        !Buffer.isBuffer(value) &&
        !(value instanceof Date))
      ? JSON.stringify(value)
      : value === undefined
        ? null
        : value;
  });
  await sql(
    connection,
    `insert into ${identifier(table)} (${columns.map(identifier).join(",")}) values (${columns.map(() => "?").join(",")})`,
    values,
  );
  return row.id;
}
export async function update(connection, table, id, fields) {
  const columns = Object.keys(fields);
  if (!columns.length) return;
  for (const key of columns)
    if (!Object.hasOwn(tables[table], key)) throw new Error("Unknown column");
  await sql(
    connection,
    `update ${identifier(table)} set ${columns.map((key) => `${identifier(key)}=?`).join(",")} where id=?`,
    [
      ...columns.map((key) =>
        Array.isArray(fields[key]) ? JSON.stringify(fields[key]) : fields[key],
      ),
      id,
    ],
  );
}
export async function audit(connection, table, row, actor, action) {
  if (
    [
      "buildings",
      "units",
      "tenants",
      "leases",
      "cheques",
      "ledger",
      "deposits",
      "documents",
      "parking_lots",
      "parking_allocations",
    ].includes(table)
  )
    await insert(connection, "activities", {
      workspace_id: row.workspace_id,
      actor_id: actor || null,
      resource_type: table,
      resource_id: row.id,
      action,
    });
}
export function normalize(rows) {
  return JSON.parse(JSON.stringify(rows)).map((row) => {
    for (const key of ["amenities"])
      if (typeof row[key] === "string") row[key] = JSON.parse(row[key]);
    if ("is_demo" in row) row.is_demo = Boolean(row.is_demo);
    if (row.created_at) row.created_at = `${row.created_at.replace(" ", "T")}Z`;
    delete row.rental_type;
    delete row.floor_key;
    return row;
  });
}
export function dbError(error) {
  return {
    code:
      error.code === "ER_DUP_ENTRY"
        ? "23505"
        : error.code === "ER_NO_REFERENCED_ROW_2" ||
            error.code === "ER_ROW_IS_REFERENCED_2"
          ? "23503"
          : error.code || "DATABASE_ERROR",
    message:
      error.code === "ER_DUP_ENTRY"
        ? "This code or reference already exists"
        : error.code?.startsWith("ER_")
          ? "The linked record or value is invalid"
          : error.message || "Database request failed",
  };
}
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
