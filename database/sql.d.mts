import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
export function databasePool(): Pool;
export function closeDatabase(): Promise<void>;
export function atomic<T>(
  workspace: string | null,
  fn: (connection: PoolConnection) => Promise<T>,
): Promise<T>;
export function sql(
  connection: Pool | PoolConnection,
  statement: string,
  values?: unknown[],
): Promise<RowDataPacket[]>;
export function one(
  connection: Pool | PoolConnection,
  statement: string,
  values?: unknown[],
): Promise<RowDataPacket | null>;
export function insert(
  connection: Pool | PoolConnection,
  table: string,
  value: Record<string, unknown>,
): Promise<string>;
