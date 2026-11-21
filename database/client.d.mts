import type { RowDataPacket } from "mysql2";
export interface DatabaseResult<T> {
  data: T;
  error: { code?: string; message: string } | null;
}
export class Query<T = RowDataPacket[]> implements PromiseLike<
  DatabaseResult<T>
> {
  select(fields?: string): Query<T>;
  eq(column: string, value: unknown): Query<T>;
  neq(column: string, value: unknown): Query<T>;
  in(column: string, value: unknown[]): Query<T>;
  order(column: string, options?: { ascending?: boolean }): Query<T>;
  limit(value: number): Query<T>;
  range(start: number, end: number): Query<T>;
  single(): Query<RowDataPacket>;
  maybeSingle(): Query<RowDataPacket | null>;
  insert(value: Record<string, unknown> | Record<string, unknown>[]): Query<T>;
  upsert(
    value: Record<string, unknown>[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): Query<T>;
  update(value: Record<string, unknown>): Query<T>;
  delete(): Query<T>;
  // biome-ignore lint/suspicious/noThenProperty: Queries intentionally implement PromiseLike for await.
  then<TResult1 = DatabaseResult<T>, TResult2 = never>(
    onfulfilled?:
      ((value: DatabaseResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
}
interface User {
  id: string;
  email: string;
  display_name?: string;
}
export class DatabaseClient {
  constructor(userId?: string | null, administrator?: boolean);
  userId: string | null;
  administrator: boolean;
  from(table: string): Query;
  rpc(
    name: string,
    parameters: Record<string, unknown>,
  ): Promise<DatabaseResult<unknown>>;
  auth: {
    getUser(): Promise<{ data: { user: User | null }; error: null }>;
    signInWithPassword(value: { email: string; password: string }): Promise<{
      data: { user: User | null };
      error: { message: string } | null;
    }>;
    signOut(): Promise<{ error: null }>;
    admin: {
      listUsers(): Promise<{ data: { users: User[] }; error: null }>;
      createUser(value: {
        id?: string;
        email: string;
        password: string;
        email_confirm?: boolean;
        user_metadata?: Record<string, unknown>;
      }): Promise<{
        data: { user: User | null };
        error: { message: string } | null;
      }>;
      deleteUser(id: string): Promise<{ error: null }>;
    };
  };
  storage: {
    from(bucket: string): {
      upload(
        key: string,
        buffer: Buffer,
        options?: { contentType?: string; upsert?: boolean },
      ): Promise<{ error: { message: string } | null }>;
      list(
        workspace: string,
        options?: { limit?: number },
      ): Promise<{ data: { name: string }[]; error: null }>;
      remove(keys: string[]): Promise<{ error: null }>;
    };
  };
  requireAdmin(): void;
}
export function adminDatabase(): DatabaseClient;
