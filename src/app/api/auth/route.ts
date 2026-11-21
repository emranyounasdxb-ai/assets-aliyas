import { z } from "zod";
import { cookies } from "next/headers";
import { serverClient, login, logout } from "@/lib/server/database";
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
    if (body.action === "logout") {
      await logout();
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
    const user = await login(email, password);
    if (!user) throw new AppError("Email or password is incorrect", 401);
    const authenticated = await serverClient();
    const { data: demoWorkspace } =
      body.action === "demo"
        ? await authenticated
            .from("workspaces")
            .select("id")
            .eq("is_demo", true)
            .limit(1)
            .maybeSingle()
        : { data: null };
    let membershipQuery = authenticated
      .from("memberships")
      .select("workspace_id")
      .eq("user_id", user.id);
    if (demoWorkspace)
      membershipQuery = membershipQuery.eq("workspace_id", demoWorkspace.id);
    const { data: member } = await membershipQuery.limit(1).maybeSingle();
    if (!member) {
      await logout();
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
