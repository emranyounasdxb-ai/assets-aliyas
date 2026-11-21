import { cookies } from "next/headers";
import { z } from "zod";
import { adminClient } from "@/lib/server/database";
import {
  apiError,
  AppError,
  getContext,
  requireOrigin,
  requireRole,
} from "@/lib/server/context";
import { boundedBody } from "@/lib/server/body";
import {
  amenities,
  amount,
  date,
  optionalText,
  signedAmount,
  text,
  uuid,
} from "@/lib/validation";
import { categories } from "@/lib/domain";

export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const { db, user, member } = await getContext();
    const w = member.workspace_id;
    const body = z
      .object({ action: text(40), data: z.record(z.string(), z.unknown()) })
      .parse(JSON.parse((await boundedBody(request, 65536)).toString()));
    const p = body.data;
    let result: {
      data: unknown;
      error: { code?: string; message: string } | null;
    };
    switch (body.action) {
      case "parking_allocate": {
        requireRole(member);
        const v = z
          .object({ lease_id: uuid, lot_ids: z.array(uuid).min(1).max(20) })
          .parse(p);
        result = await db.rpc("allocate_parking", {
          l: v.lease_id,
          lot_ids: v.lot_ids,
        });
        break;
      }
      case "parking_cancel": {
        requireRole(member);
        result = await db.rpc("cancel_parking_allocation", {
          a: uuid.parse(p.id),
        });
        break;
      }
      case "parking_lot": {
        requireRole(member);
        const v = z
          .object({
            id: uuid.optional(),
            building_id: uuid,
            floor_id: z
              .union([uuid, z.literal("")])
              .transform((v) => v || null),
            number: text(40),
            status: z.enum(["available", "blocked"]),
            rate_amount: z
              .union([amount, z.literal("")])
              .transform((v) => (v === "" ? null : v)),
            rate_period: z
              .union([z.enum(["monthly", "yearly"]), z.literal("")])
              .transform((v) => v || null),
            notes: optionalText(1000),
          })
          .parse(p);
        if ((v.rate_amount === null) !== (v.rate_period === null))
          throw new AppError(
            "Enter both the parking rate and its billing period, or leave both blank",
          );
        const { id, ...fields } = v;
        result = id
          ? await db
              .from("parking_lots")
              .update(fields)
              .eq("id", id)
              .eq("workspace_id", w)
              .select("id")
              .single()
          : await db
              .from("parking_lots")
              .insert({ ...fields, workspace_id: w })
              .select("id")
              .single();
        break;
      }
      case "building": {
        requireRole(member);
        const v = z
          .object({
            id: uuid.optional(),
            name: text(),
            code: text(24),
            area: text(120),
            address: optionalText(300),
            amenities,
            notes: optionalText(2000),
            color: z.enum(["sage", "sand", "slate", "rose"]).default("sage"),
            declared_levels: z.preprocess(
              (value) => (value === "" || value === undefined ? null : value),
              z.coerce.number().int().min(1).max(250).nullable(),
            ),
            floor_count: z.coerce.number().int().min(0).max(100).default(3),
          })
          .parse(p);
        const { id, floor_count, ...fields } = v;
        result = id
          ? await db
              .from("buildings")
              .update(fields)
              .eq("id", id)
              .eq("workspace_id", w)
              .select("id")
              .single()
          : await db.rpc("create_building", { w, p: fields, floor_count });
        break;
      }
      case "floor": {
        requireRole(member);
        const v = z
          .object({
            id: uuid.optional(),
            building_id: uuid,
            name: text(80),
            ordinal: z.coerce.number().int().min(-10).max(200),
            purpose: z
              .enum(["unspecified", "residential", "parking", "service"])
              .default("unspecified"),
            notes: optionalText(1000),
          })
          .parse(p);
        const { id, ...fields } = v;
        result = id
          ? await db
              .from("floors")
              .update(fields)
              .eq("id", id)
              .eq("workspace_id", w)
              .select("id")
              .single()
          : await db
              .from("floors")
              .insert({ ...fields, workspace_id: w })
              .select("id")
              .single();
        break;
      }
      case "unit":
      case "shop": {
        requireRole(member);
        const v = z
          .object({
            id: uuid.optional(),
            building_id: uuid,
            floor_id: uuid,
            code: text(30),
            category:
              body.action === "shop"
                ? z.literal("Shop").default("Shop")
                : z.enum(categories),
            monthly_rent: amount,
            area_sqft: z.coerce.number().int().min(0).max(1000000).default(0),
            status: z.enum(["available", "maintenance"]).default("available"),
            amenities,
            notes: optionalText(2000),
          })
          .parse(p);
        const { id, ...fields } = v;
        result = id
          ? await db
              .from("units")
              .update(fields)
              .eq("id", id)
              .eq("workspace_id", w)
              .select("id")
              .single()
          : await db
              .from("units")
              .insert({ ...fields, workspace_id: w })
              .select("id")
              .single();
        break;
      }
      case "tenant": {
        requireRole(member);
        const v = z
          .object({
            id: uuid.optional(),
            name: text(),
            email: z.union([z.email().max(180), z.literal("")]).default(""),
            phone: text(40),
            nationality: optionalText(80),
            company_name: optionalText(160),
            trade_license: optionalText(120),
            notes: optionalText(2000),
            opening: signedAmount.default(0),
          })
          .parse(p);
        const { id, opening, ...fields } = v;
        result = id
          ? await db
              .from("tenants")
              .update(fields)
              .eq("id", id)
              .eq("workspace_id", w)
              .select("id")
              .single()
          : await db.rpc("create_tenant", { w, details: fields, opening });
        break;
      }
      case "lease": {
        requireRole(member);
        const v = z
          .object({
            tenant_id: uuid,
            unit_id: uuid,
            start_date: date,
            annual_rent: amount.refine((n) => n > 0),
            installments: z.coerce
              .number()
              .int()
              .refine((n) => [1, 2, 3, 4, 6, 12].includes(n)),
            reference: text(40),
            bank: optionalText(120),
            notes: optionalText(2000),
            parking_lot_ids: z.array(uuid).max(20).default([]),
          })
          .parse(p);
        result = await db.rpc(
          v.parking_lot_ids.length
            ? "create_lease_with_parking"
            : "create_lease",
          {
            w,
            t: v.tenant_id,
            u: v.unit_id,
            starts: v.start_date,
            rent: v.annual_rent,
            checks: v.installments,
            ref: v.reference,
            bank_name: v.bank,
            notes_text: v.notes,
            ...(v.parking_lot_ids.length ? { lot_ids: v.parking_lot_ids } : {}),
          },
        );
        break;
      }
      case "cheque": {
        requireRole(member, true);
        const v = z
          .object({
            id: uuid,
            status: z.enum([
              "scheduled",
              "received",
              "deposited",
              "cleared",
              "bounced",
              "cancelled",
              "returned",
            ]),
            number: text(50),
            bank: optionalText(120),
            on_date: date,
          })
          .parse(p);
        const { data: existing } = await db
          .from("cheques")
          .select("status,number,bank")
          .eq("id", v.id)
          .eq("workspace_id", w)
          .single();
        if (!existing) throw new AppError("Cheque not found", 404);
        if (
          ["cleared", "cancelled", "returned"].includes(existing.status) &&
          existing.status === v.status &&
          existing.number === v.number &&
          existing.bank === v.bank
        )
          return Response.json({ ok: true, result: v.id });
        result =
          existing.status === v.status
            ? await db.rpc("update_cheque_details", {
                c: v.id,
                ref: v.number,
                bank_name: v.bank,
              })
            : await db.rpc("set_cheque_status", {
                c: v.id,
                new_status: v.status,
                on_date: v.on_date,
                new_number: v.number,
                new_bank: v.bank,
              });
        break;
      }
      case "account": {
        requireRole(member, true);
        const v = z
          .object({
            tenant_id: uuid,
            amount: signedAmount.refine((n) => n !== 0),
            kind: z.enum(["payment", "adjustment"]),
            description: text(300),
            entry_date: date,
            request_key: uuid,
          })
          .parse(p);
        result = await db.rpc("record_account_entry", {
          w,
          t: v.tenant_id,
          amount_cents: v.amount,
          entry_kind: v.kind,
          label: v.description,
          on_date: v.entry_date,
          request_key: v.request_key,
        });
        break;
      }
      case "security": {
        requireRole(member, true);
        const v = z
          .object({
            tenant_id: uuid,
            amount: amount.refine((n) => n > 0),
            reference: text(160),
            type: z.enum(["cash", "cheque"]),
            bank: optionalText(120),
          })
          .parse(p);
        result = await db.rpc("add_security", {
          w,
          t: v.tenant_id,
          amount_cents: v.amount,
          ref: v.reference,
          is_cheque: v.type === "cheque",
          bank_name: v.bank,
        });
        break;
      }
      case "return_deposit": {
        requireRole(member, true);
        result = await db.rpc("return_deposit", { d: uuid.parse(p.id) });
        break;
      }
      case "end_lease": {
        requireRole(member);
        result = await db.rpc("end_lease", {
          l: uuid.parse(p.id),
          on_date: date.parse(p.on_date),
        });
        break;
      }
      case "workspace_update": {
        if (member.role !== "owner")
          throw new AppError(
            "Only the workspace owner can change these details",
            403,
          );
        const v = z
          .object({
            name: text(),
            address: optionalText(300),
            email: z.union([z.email(), z.literal("")]).default(""),
            phone: optionalText(40),
          })
          .parse(p);
        result = await db
          .from("workspaces")
          .update(v)
          .eq("id", w)
          .select("id")
          .single();
        break;
      }
      case "workspace_switch": {
        const id = uuid.parse(p.id);
        const { data: found } = await db
          .from("memberships")
          .select("workspace_id")
          .eq("user_id", user.id)
          .eq("workspace_id", id)
          .maybeSingle();
        if (!found) throw new AppError("Workspace not found", 404);
        (await cookies()).set("aliyas-workspace", id, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: process.env.APP_ORIGIN?.startsWith("https://") ?? false,
        });
        return Response.json({ ok: true });
      }
      case "workspace_create": {
        if (member.role !== "owner")
          throw new AppError("Only an owner can create a workspace", 403);
        const name = text().parse(p.name);
        const admin = adminClient();
        const { data: created, error: createError } = await admin
          .from("workspaces")
          .insert({ name })
          .select("id")
          .single();
        if (createError || !created)
          throw new AppError("Could not create the workspace", 503);
        const { error: memberError } = await admin.from("memberships").insert({
          workspace_id: created.id,
          user_id: user.id,
          role: "owner",
          display_name: member.display_name,
        });
        if (memberError) {
          await admin.from("workspaces").delete().eq("id", created.id);
          throw new AppError("Could not create the workspace", 503);
        }
        (await cookies()).set("aliyas-workspace", created.id, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: process.env.APP_ORIGIN?.startsWith("https://") ?? false,
        });
        return Response.json({ ok: true, id: created.id });
      }
      case "notifications_read": {
        const ids = z.array(uuid).max(100).parse(p.ids);
        const { data: allowed } = await db
          .from("notifications")
          .select("id")
          .eq("workspace_id", w)
          .in("id", ids);
        result = await db.from("notification_reads").upsert(
          (allowed ?? []).map((n) => ({
            notification_id: n.id,
            user_id: user.id,
          })),
          { onConflict: "notification_id,user_id", ignoreDuplicates: true },
        );
        break;
      }
      default:
        throw new AppError("Unknown action");
    }
    if (result.error) {
      if (result.error.code === "23P01")
        throw new AppError(
          "A selected parking lot is already reserved for these dates. Refresh and choose an available space.",
        );
      if (result.error.code === "P0001")
        throw new AppError(result.error.message);
      if (result.error.code === "23505")
        throw new AppError(
          "That code or reference already exists. Choose a different one.",
        );
      if (result.error.code === "23503")
        throw new AppError("Choose a valid linked record from this workspace.");
      throw result.error;
    }
    return Response.json({ ok: true, result: result.data });
  } catch (error) {
    return apiError(error);
  }
}
