import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import db, { getStableItemById } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { UPLOAD_DIR, ensureUploadDir, IMAGE_EXT } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Upload / replace the photo of a permanent product. Stored on the data volume;
 *  the stable item's image_url is set to the served /api/uploads/<file> path. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    await requireAdmin();
    const id = Number(params.id);
    const item = getStableItemById(id);
    if (!item) return jsonError(404, "Produsul nu a fost găsit.");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError(400, "Lipsește fișierul imagine.");
    const ext = IMAGE_EXT[file.type];
    if (!ext) return jsonError(400, "Format acceptat: JPG, PNG, WEBP sau GIF.");
    if (file.size > 6 * 1024 * 1024) return jsonError(400, "Imaginea este prea mare (max. 6 MB).");

    ensureUploadDir();
    const name = `stable-${id}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));

    // Remove the previous image if it was one of ours.
    if (item.image_url && item.image_url.startsWith("/api/uploads/")) {
      const old = item.image_url.split("/").pop();
      try { if (old && old.startsWith("stable-")) fs.unlinkSync(path.join(UPLOAD_DIR, old)); } catch { /* ignore */ }
    }

    const url = `/api/uploads/${name}`;
    db.prepare("UPDATE stable_items SET image_url = ?, updated_at = datetime('now') WHERE id = ?").run(url, id);
    return NextResponse.json({ ok: true, image_url: url });
  });
}
