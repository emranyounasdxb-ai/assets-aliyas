import { createStatements } from "../database/schema.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { databasePool, sql, closeDatabase } from "../database/sql.mjs";
const database = new URL(process.env.DATABASE_URL || "").pathname.slice(1);
assert.ok(
  ["aliyas_assets", "aliyasrealestate_assets"].includes(database),
  "Migrations may only target the dedicated assets database",
);
const connection = await databasePool().getConnection();
try {
  const [[{ version }]] = await connection.query("select version() version");
  if (
    !/^10\.11\./.test(version) &&
    !/^11\./.test(version) &&
    !/^8\.[04]\./.test(version)
  )
    throw new Error("Verify MariaDB/MySQL compatibility before migrating");
  const statements = createStatements(1);
  const checksum = createHash("sha256")
    .update(statements.join("\n"))
    .digest("hex");
  await sql(
    connection,
    "create table if not exists schema_migrations(version varchar(80) primary key,checksum char(64) not null,applied_at datetime(3) not null default current_timestamp(3)) engine=InnoDB",
  );
  const previous = await sql(
    connection,
    "select checksum from schema_migrations where version=?",
    ["001_self_hosted"],
  );
  assert.ok(
    !previous.length || previous[0].checksum === checksum,
    "Schema changed: add an explicit versioned migration before upgrading",
  );
  for (const statement of statements) await sql(connection, statement);
  await sql(
    connection,
    "insert ignore into schema_migrations(version,checksum) values(?,?)",
    ["001_self_hosted", checksum],
  );
  const media = createStatements().filter((s) =>
    s.startsWith("create table if not exists `property_covers`"),
  );
  const mediaChecksum = createHash("sha256")
    .update(media.join("\n"))
    .digest("hex");
  const appliedMedia = await sql(
    connection,
    "select checksum from schema_migrations where version=?",
    ["002_property_media"],
  );
  assert.ok(
    !appliedMedia.length || appliedMedia[0].checksum === mediaChecksum,
    "Property media migration checksum changed",
  );
  for (const statement of media) await sql(connection, statement);
  await sql(
    connection,
    "insert ignore into schema_migrations(version,checksum) values(?,?)",
    ["002_property_media", mediaChecksum],
  );
  const agents = createStatements().filter((s) =>
    /^create table if not exists `agent/.test(s),
  );
  const agentChecksum = createHash("sha256")
    .update(agents.join("\n"))
    .digest("hex");
  const appliedAgents = await sql(
    connection,
    "select checksum from schema_migrations where version=?",
    ["003_agent_commissions"],
  );
  assert.ok(
    !appliedAgents.length || appliedAgents[0].checksum === agentChecksum,
    "Agent commission migration checksum changed",
  );
  for (const statement of agents) await sql(connection, statement);
  await sql(
    connection,
    "insert ignore into schema_migrations(version,checksum) values(?,?)",
    ["003_agent_commissions", agentChecksum],
  );
  console.log("Assets database schema ready; existing records preserved.");
} finally {
  connection.release();
  await closeDatabase();
}
