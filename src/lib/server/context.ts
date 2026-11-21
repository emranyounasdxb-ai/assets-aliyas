import "server-only";
import { cookies } from "next/headers";
import { serverClient } from "@/lib/supabase/server";
import type { AppData, Membership } from "@/lib/domain";
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function getContext() {
  const db = await serverClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new AppError("Please sign in to continue", 401);
  const selected = (await cookies()).get("aliyas-workspace")?.value;
  let query = db.from("memberships").select("*").eq("user_id", user.id);
  if (selected) query = query.eq("workspace_id", selected);
  const { data: member, error: memberError } = await query
    .order("workspace_id")
    .limit(1)
    .maybeSingle();
  if (memberError || !member)
    throw new AppError("Your account is not assigned to a workspace", 403);
  return { db, user, member: member as Membership };
}
export function requireOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const expected =
    process.env.APP_ORIGIN || `${new URL(request.url).protocol}//${host}`;
  if (
    !origin ||
    (origin !== expected &&
      origin !== `${new URL(request.url).protocol}//${host}`)
  )
    throw new AppError("This request could not be verified", 403);
}
export function requireRole(member: Membership, finance = false) {
  if (
    !(
      finance ? ["owner", "manager", "accountant"] : ["owner", "manager"]
    ).includes(member.role)
  )
    throw new AppError("Your role does not allow this change", 403);
}
export function apiError(error: unknown) {
  if (error instanceof SyntaxError)
    return Response.json(
      { error: "The request could not be read. Please try again." },
      { status: 400 },
    );
  if (error instanceof AppError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error && typeof error === "object" && "issues" in error)
    return Response.json(
      { error: "Check the required fields and amounts, then try again." },
      { status: 400 },
    );
  console.error(
    "Application request failed",
    error instanceof Error ? error.name : "Database error",
  );
  return Response.json(
    { error: "This change could not be saved. Refresh and try again." },
    { status: 500 },
  );
}
export async function loadData(): Promise<AppData> {
  const { db, user, member } = await getContext();
  const tables = [
    "workspaces",
    "memberships",
    "buildings",
    "floors",
    "units",
    "tenants",
    "leases",
    "cheques",
    "ledger",
    "deposits",
    "parking_lots",
    "parking_allocations",
    "documents",
    "notifications",
    "activities",
  ] as const;
  const results = await Promise.all(
    tables.map(async (table) => {
      const query =
        table === "documents"
          ? db
              .from(table)
              .select(
                "id,workspace_id,target_type,target_id,category,name,mime,size,group_id,version,status,thumbnail_path,created_at,scan_engine",
              )
          : db.from(table).select("*");
      const scoped = (
        table === "workspaces"
          ? query
          : query.eq("workspace_id", member.workspace_id)
      )
        .order(
          table === "floors"
            ? "ordinal"
            : table === "memberships"
              ? "display_name"
              : table === "deposits"
                ? "received_on"
                : "created_at",
          { ascending: table === "floors" || table === "memberships" },
        )
        .order(table === "memberships" ? "user_id" : "id");
      const pageSize = table === "activities" ? 40 : 1000;
      const collected: Record<string, unknown>[] = [];
      for (let offset = 0; ; offset += pageSize) {
        const page = await scoped.range(offset, offset + pageSize - 1);
        if (page.error) return { data: collected, error: page.error };
        const values = (page.data ?? []) as Record<string, unknown>[];
        collected.push(...values);
        if (table === "activities" || values.length < pageSize) break;
      }
      return { data: collected, error: null };
    }),
  );
  for (let i = 0; i < results.length; i++)
    if (results[i].error)
      throw new AppError(`Could not load ${tables[i]}. Please try again.`, 503);
  const { data: reads, error: readError } = await db
    .from("notification_reads")
    .select("notification_id")
    .eq("user_id", user.id);
  if (readError) throw new AppError("Could not load notifications", 503);
  const rows = Object.fromEntries(
    tables.map((t, i) => [t, results[i].data ?? []]),
  );
  return {
    workspace: rows.workspaces.find((w) => w.id === member.workspace_id),
    workspaces: rows.workspaces,
    membership: member,
    members: rows.memberships,
    buildings: rows.buildings,
    floors: rows.floors,
    units: rows.units,
    tenants: rows.tenants,
    leases: rows.leases,
    cheques: rows.cheques,
    ledger: rows.ledger,
    deposits: rows.deposits,
    parkingLots: rows.parking_lots,
    parkingAllocations: rows.parking_allocations,
    documents: rows.documents,
    notifications: rows.notifications,
    activities: rows.activities,
    readNotifications: (reads ?? []).map((r) => r.notification_id),
  } as unknown as AppData;
}
