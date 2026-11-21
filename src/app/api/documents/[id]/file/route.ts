import { z } from "zod";
import { adminClient } from "@/lib/supabase/server";
import { apiError, AppError, getContext } from "@/lib/server/context";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { db, member } = await getContext();
    const id = z.uuid().parse((await params).id);
    const { data: doc } = await db
      .from("documents")
      .select("*")
      .eq("id", id)
      .eq("workspace_id", member.workspace_id)
      .neq("status", "archived")
      .maybeSingle();
    if (!doc) throw new AppError("Document not found or access denied", 404);
    const url = new URL(request.url);
    const thumbnail = url.searchParams.get("preview") === "1";
    const path =
      thumbnail && doc.thumbnail_path ? doc.thumbnail_path : doc.storage_path;
    const { data, error } = await adminClient()
      .storage.from("aliyas-private")
      .createSignedUrl(path, 60, {
        download: url.searchParams.get("download") === "1" ? doc.name : false,
      });
    if (error || !data)
      throw new AppError(
        "This file is temporarily unavailable. Please try again.",
        503,
      );
    return new Response(null, {
      status: 302,
      headers: {
        Location: data.signedUrl,
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
