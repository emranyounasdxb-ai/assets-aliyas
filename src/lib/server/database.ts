import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { DatabaseClient, adminDatabase } from "../../../database/client.mjs";
import {
  atomic,
  databasePool,
  one,
  sql,
  insert,
} from "../../../database/sql.mjs";
import {
  tokenHash,
  verifyPassword,
  hashPassword,
} from "../../../database/passwords.mjs";
const COOKIE = "aliyas-session";
const SESSION_HOURS = 12;
export const adminClient = adminDatabase;
export async function serverClient() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return new DatabaseClient();
  const session = await one(
    databasePool(),
    "select s.id,s.user_id from sessions s join users u on u.id=s.user_id where s.token_hash=? and s.expires_at>utc_timestamp(3) and s.last_seen>utc_timestamp(3)-interval 30 minute and u.disabled=false",
    [tokenHash(token)],
  );
  if (!session) return new DatabaseClient();
  await sql(
    databasePool(),
    "update sessions set last_seen=utc_timestamp(3) where id=? and last_seen<utc_timestamp(3)-interval 2 minute",
    [session.id],
  );
  return new DatabaseClient(session.user_id);
}
let dummyPassword: Promise<string>;
export async function login(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const digest = tokenHash(normalized);
  const attempts = await atomic(null, async (connection) => {
    await sql(
      connection,
      "insert ignore into login_attempts(id,email_hash,window_start) values(uuid(),?,utc_timestamp(3))",
      [digest],
    );
    await sql(
      connection,
      "update login_attempts set attempts=0,window_start=utc_timestamp(3) where email_hash=? and window_start<utc_timestamp(3)-interval 15 minute",
      [digest],
    );
    const row = await one(
      connection,
      "select attempts from login_attempts where email_hash=? for update",
      [digest],
    );
    await sql(
      connection,
      "update login_attempts set attempts=attempts+1 where email_hash=?",
      [digest],
    );
    return row?.attempts ?? 0;
  });
  if (attempts >= 8) return null;
  const user = await one(
    databasePool(),
    "select * from users where email=? and disabled=false",
    [normalized],
  );
  dummyPassword ||= hashPassword(randomBytes(32).toString("hex"));
  const valid = await verifyPassword(
    password,
    user?.password_hash || (await dummyPassword),
  );
  if (!user || !valid) return null;
  const token = randomBytes(32).toString("base64url");
  await atomic(null, async (connection) => {
    await sql(connection, "delete from login_attempts where email_hash=?", [
      digest,
    ]);
    await sql(
      connection,
      "delete from sessions where expires_at<utc_timestamp(3) or last_seen<utc_timestamp(3)-interval 30 minute",
    );
    await insert(connection, "sessions", {
      user_id: user.id,
      token_hash: tokenHash(token),
      expires_at: new Date(Date.now() + SESSION_HOURS * 3600000),
      last_seen: new Date(),
    });
  });
  const jar = await cookies();
  const previous = jar.get(COOKIE)?.value;
  if (previous)
    await sql(databasePool(), "delete from sessions where token_hash=?", [
      tokenHash(previous),
    ]);
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.APP_ORIGIN?.startsWith("https://") ?? false,
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return { id: user.id, email: user.email };
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token)
    await sql(databasePool(), "delete from sessions where token_hash=?", [
      tokenHash(token),
    ]);
  jar.delete(COOKIE);
}
