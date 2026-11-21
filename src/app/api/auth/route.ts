import { z } from "zod";
import { cookies } from "next/headers";
import { serverClient } from "@/lib/supabase/server";
import { apiError, AppError, requireOrigin } from "@/lib/server/context";
import { boundedBody } from "@/lib/server/body";
import { localDemoAllowed } from "@/lib/server/env";
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const body = z
      .object({
        action: z.enum(["login", "demo", "logout"]),
        email: z.string().max(180).optional(),
        password: z.string().max(200).optional(),
      })
      .parse(JSON.parse((await boundedBody(request, 8192)).toString()));
    const db = await serverClient();
    if (body.action === "logout") {
      await db.auth.signOut();
      (await cookies()).delete("aliyas-workspace");
      return Response.json({ ok: true });
    }
    if (
      body.action === "demo" &&
      !localDemoAllowed(request.headers.get("host"))
    )
      throw new AppError(
        "Demo sign in is available only in the local development preview",
        403,
      );
    const email = body.action === "demo" ? process.env.DEMO_EMAIL : body.email;
    const password =
      body.action === "demo" ? process.env.DEMO_PASSWORD : body.password;
    if (!email || !password)
      throw new AppError("Enter your email and password");
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user)
      throw new AppError("Email or password is incorrect", 401);
    const { data: demoWorkspace } =
      body.action === "demo"
        ? await db
            .from("workspaces")
            .select("id")
            .eq("is_demo", true)
            .limit(1)
            .maybeSingle()
        : { data: null };
    let membershipQuery = db
      .from("memberships")
      .select("workspace_id")
      .eq("user_id", data.user.id);
    if (demoWorkspace)
      membershipQuery = membershipQuery.eq("workspace_id", demoWorkspace.id);
    const { data: member } = await membershipQuery.limit(1).maybeSingle();
    if (!member) {
      await db.auth.signOut();
      throw new AppError("This account has no workspace assigned", 403);
    }
    (await cookies()).set("aliyas-workspace", member.workspace_id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.APP_ORIGIN?.startsWith("https://") ?? false,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
