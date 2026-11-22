import { z } from "zod";
import { privateFile } from "../../../../../../database/storage.mjs";
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
    const data = await privateFile(path);
    const download = url.searchParams.get("download") === "1";
    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type":
          thumbnail && doc.thumbnail_path ? "image/webp" : doc.mime,
        "Content-Length": String(data.length),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
