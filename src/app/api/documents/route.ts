import { createHash } from "node:crypto";
import sharp from "sharp";
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
import { scanUpload } from "@/lib/server/scanner";
import { documentCategories } from "@/lib/domain";
export const runtime = "nodejs";
export async function POST(request: Request) {
  let savedPaths: string[] = [];
  try {
    requireOrigin(request);
    const { db, user, member } = await getContext();
    requireRole(member, true);
    const bytes = await boundedBody(request, 21 * 1024 * 1024);
    const form = await new Response(bytes, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size < 1 ||
      file.size > 20 * 1024 * 1024
    )
      throw new AppError("Choose a file up to 20 MB");
    const target_type = z
      .enum(["building", "floor", "unit", "tenant", "lease"])
      .parse(form.get("target_type"));
    const target_id = z.uuid().parse(form.get("target_id"));
    const category = z.enum(documentCategories).parse(form.get("category"));
    const replaces = z
      .uuid()
      .nullable()
      .parse(form.get("replaces") || null);
    const uploadKey = z.uuid().parse(form.get("request_key"));
    const admin = adminClient();
    const { data: previousUpload } = await admin
      .from("documents")
      .select("id")
      .eq("workspace_id", member.workspace_id)
      .eq("uploaded_by", user.id)
      .eq("upload_key", uploadKey)
      .maybeSingle();
    if (previousUpload)
      return Response.json({ ok: true, id: previousUpload.id });
    const table = {
      building: "buildings",
      floor: "floors",
      unit: "units",
      tenant: "tenants",
      lease: "leases",
    }[target_type];
    const { data: target } = await db
      .from(table)
      .select("id")
      .eq("id", target_id)
      .eq("workspace_id", member.workspace_id)
      .maybeSingle();
    if (!target) throw new AppError("The linked record was not found", 404);
    if (replaces) {
      const { data: original } = await db
        .from("documents")
        .select("id")
        .eq("id", replaces)
        .eq("workspace_id", member.workspace_id)
        .eq("target_type", target_type)
        .eq("target_id", target_id)
        .eq("category", category)
        .eq("status", "current")
        .maybeSingle();
      if (!original)
        throw new AppError("Choose the current document version to replace");
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const isPdf = buffer.subarray(0, 5).toString() === "%PDF-";
    const isPng = buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg = buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
    const isWebp =
      buffer.subarray(0, 4).toString() === "RIFF" &&
      buffer.subarray(8, 12).toString() === "WEBP";
    if (!isPdf && !isPng && !isJpeg && !isWebp)
      throw new AppError("Upload a valid PDF, JPG, PNG or WebP file.");
    const scanEngine = await scanUpload(buffer);
    let mime: string;
    let ext: string;
    let thumbnail: Buffer | undefined;
    if (buffer.subarray(0, 5).toString() === "%PDF-") {
      if (
        !buffer
          .subarray(Math.max(0, buffer.length - 2048))
          .toString("latin1")
          .includes("%%EOF")
      )
        throw new AppError("This PDF appears to be incomplete");
      mime = "application/pdf";
      ext = "pdf";
    } else {
      try {
        const meta = await sharp(buffer, {
          limitInputPixels: 40000000,
        }).metadata();
        const formats: Record<string, [string, string]> = {
          jpeg: ["image/jpeg", "jpg"],
          png: ["image/png", "png"],
          webp: ["image/webp", "webp"],
        };
        if (!meta.format || !formats[meta.format])
          throw new Error("Unsupported image");
        [mime, ext] = formats[meta.format];
        thumbnail = await sharp(buffer, { limitInputPixels: 40000000 })
          .rotate()
          .resize(720, 480, { fit: "cover", withoutEnlargement: true })
          .webp({ quality: 78 })
          .toBuffer();
      } catch {
        throw new AppError(
          "Upload a valid PDF, JPG, PNG or WebP file. Images must be under 40 megapixels.",
        );
      }
    }
    if (category === "Photo" && !mime.startsWith("image/"))
      throw new AppError("Choose an image for a property photo");
    const key = `${member.workspace_id}/${uploadKey}`;
    const originalPath = `${key}.${ext}`;
    const thumbPath = thumbnail ? `${key}.preview.webp` : null;
    const { error: uploadError } = await admin.storage
      .from("aliyas-private")
      .upload(originalPath, buffer, { contentType: mime, upsert: false });
    if (uploadError)
      throw new AppError(
        "The file could not be stored. Please try again.",
        503,
      );
    savedPaths.push(originalPath);
    if (thumbnail && thumbPath) {
      const { error } = await admin.storage
        .from("aliyas-private")
        .upload(thumbPath, thumbnail, {
          contentType: "image/webp",
          upsert: false,
        });
      if (error) throw new AppError("Could not save the image preview", 503);
      savedPaths.push(thumbPath);
    }
    const safeName =
      [...file.name]
        .map((char) => {
          const code = char.codePointAt(0) ?? 0;
          return code < 32 || code === 127 || char === "/" || char === "\\"
            ? "_"
            : char;
        })
        .join("")
        .slice(0, 200) || `document.${ext}`;
    const { data: id, error } = await admin.rpc("register_scanned_document", {
      p: {
        workspace_id: member.workspace_id,
        target_type,
        target_id,
        category,
        replaces,
        name: safeName,
        mime,
        size: file.size,
        storage_path: originalPath,
        thumbnail_path: thumbPath,
        sha256: createHash("sha256").update(buffer).digest("hex"),
        scan_engine: scanEngine,
        uploaded_by: user.id,
        upload_key: uploadKey,
      },
    });
    if (error)
      throw new AppError(
        error.code === "P0001"
          ? error.message
          : "The document record could not be saved",
        409,
      );
    savedPaths = [];
    return Response.json({ ok: true, id });
  } catch (error) {
    if (savedPaths.length)
      await adminClient().storage.from("aliyas-private").remove(savedPaths);
    return apiError(error);
  }
}
