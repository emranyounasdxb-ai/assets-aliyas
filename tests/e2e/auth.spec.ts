import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { adminDatabase } from "../../database/client.mjs";
import { databasePool, sql, closeDatabase } from "../../database/sql.mjs";
import { tokenHash } from "../../database/passwords.mjs";
const origin = "http://127.0.0.1:3200";
test.afterAll(async () => {
  await closeDatabase();
});
test("stores a private session and rejects its replay after logout", async ({
  browser,
}) => {
  const primary = await browser.newContext(),
    replay = await browser.newContext();
  try {
    const denied = await primary.request.post(`${origin}/api/auth`, {
      headers: { origin: "https://untrusted.example.test" },
      data: { action: "demo" },
    });
    expect(denied.status()).toBe(403);
    const login = await primary.request.post(`${origin}/api/auth`, {
      headers: { origin },
      data: { action: "demo" },
    });
    expect(login.ok()).toBe(true);
    const session = (await primary.cookies()).find(
      (cookie) => cookie.name === "aliyas-session",
    );
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe("Lax");
    expect(session?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await replay.addCookies(await primary.cookies());
    expect((await replay.request.get(`${origin}/api/workspace`)).status()).toBe(
      200,
    );
    expect(
      (
        await primary.request.post(`${origin}/api/auth`, {
          headers: { origin },
          data: { action: "logout" },
        })
      ).ok(),
    ).toBe(true);
    expect((await replay.request.get(`${origin}/api/workspace`)).status()).toBe(
      401,
    );
  } finally {
    await primary.close();
    await replay.close();
  }
});
test("limits password guesses persistently and allows login after the window expires", async ({
  browser,
}) => {
  const admin = adminDatabase(),
    ctx = await browser.newContext();
  const email = `verification-auth-${randomBytes(8).toString("hex")}@example.test`,
    password = randomBytes(24).toString("hex");
  const { data: user, error } = await admin.auth.admin.createUser({
    email,
    password,
  });
  expect(error).toBeNull();
  if (!user.user) throw new Error("Verification user missing");
  const { data: workspace } = await admin
    .from("workspaces")
    .insert({ name: "Verification auth workspace" })
    .select("id")
    .single();
  await admin.from("memberships").insert({
    workspace_id: workspace.id,
    user_id: user.user.id,
    role: "viewer",
    display_name: "Verification viewer",
  });
  try {
    for (let i = 0; i < 8; i++)
      expect(
        (
          await ctx.request.post(`${origin}/api/auth`, {
            headers: { origin },
            data: {
              action: "login",
              email,
              password: "incorrect verification password",
            },
          })
        ).status(),
      ).toBe(401);
    expect(
      (
        await ctx.request.post(`${origin}/api/auth`, {
          headers: { origin },
          data: { action: "login", email, password },
        })
      ).status(),
    ).toBe(401);
    await sql(
      databasePool(),
      "update login_attempts set window_start=utc_timestamp(3)-interval 16 minute where email_hash=?",
      [tokenHash(email)],
    );
    expect(
      (
        await ctx.request.post(`${origin}/api/auth`, {
          headers: { origin },
          data: { action: "login", email, password },
        })
      ).ok(),
    ).toBe(true);
    expect((await ctx.request.get(`${origin}/api/workspace`)).status()).toBe(
      200,
    );
  } finally {
    await ctx.close();
    await admin.from("memberships").delete().eq("user_id", user.user.id);
    await admin.from("workspaces").delete().eq("id", workspace.id);
    await admin.auth.admin.deleteUser(user.user.id);
    await sql(databasePool(), "delete from login_attempts where email_hash=?", [
      tokenHash(email),
    ]);
  }
});
