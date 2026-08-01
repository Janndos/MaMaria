import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import db from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { ensureUploadDir, IMAGE_EXT, UPLOAD_DIR } from "@/lib/uploads";
import { sendMessage, sendPhoto, telegramConfigured } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE = 6 * 1024 * 1024; // 6 MB
const CAPTION_MAX = 1024;          // Telegram photo-caption limit

/**
 * Publish a news announcement. The bot posts it to the Telegram channel
 * automatically — as a photo + caption when an image is attached, otherwise as a
 * text message. The post is always saved to the site even if Telegram fails or is
 * not configured, so nothing is lost.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const form = await req.formData();
    const title = String(form.get("title") ?? "").trim();
    const body = String(form.get("body") ?? "").trim();
    if (!title || !body) return jsonError(400, "Titlul și textul sunt obligatorii.");

    // Optional image: validate type/size, persist to the uploads volume.
    let imageUrl: string | null = null;
    let imageBuf: Buffer | null = null;
    let imageType = "image/png";
    const image = form.get("image");
    if (image && typeof image === "object" && "arrayBuffer" in image && image.size > 0) {
      const ext = IMAGE_EXT[image.type];
      if (!ext) return jsonError(400, "Format imagine neacceptat (JPG, PNG, WEBP sau GIF).");
      if (image.size > MAX_IMAGE) return jsonError(400, "Imaginea depășește 6 MB.");
      imageBuf = Buffer.from(await image.arrayBuffer());
      imageType = image.type;
      ensureUploadDir();
      const name = `news-${Date.now()}.${ext}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, name), imageBuf);
      imageUrl = `/api/uploads/${name}`;
    }

    // Auto-post to Telegram (best-effort — never blocks saving the post).
    const telegram: { posted: boolean; error?: string } = { posted: false };
    let tgUrl: string | null = null;
    if (telegramConfigured()) {
      const full = `${title}\n\n${body}`;
      const res = imageBuf
        ? await sendPhoto(imageBuf, full.slice(0, CAPTION_MAX), { filename: `noutate.${IMAGE_EXT[imageType] ?? "png"}`, type: imageType })
        : await sendMessage(full);
      if (res.ok) { telegram.posted = true; tgUrl = res.url ?? null; }
      else telegram.error = res.error;
    } else {
      telegram.error = "Telegram nu este configurat — noutatea a fost salvată doar pe site.";
    }

    const id = db.prepare(
      "INSERT INTO news_posts (title, body, image_url, tg_url) VALUES (?,?,?,?)"
    ).run(title, body, imageUrl, tgUrl).lastInsertRowid;

    return NextResponse.json({ ok: true, id: Number(id), telegram });
  });
}
