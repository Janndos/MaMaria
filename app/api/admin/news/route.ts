import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import db from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { ensureUploadDir, IMAGE_EXT, VIDEO_EXT, UPLOAD_DIR } from "@/lib/uploads";
import { sendMessage, sendPhoto, sendVideo, telegramConfigured } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE = 6 * 1024 * 1024;  // 6 MB
const MAX_VIDEO = 48 * 1024 * 1024; // 48 MB — Telegram's bot upload limit is 50 MB
const CAPTION_MAX = 1024;           // Telegram photo/video-caption limit

/** Read one optional uploaded file from the form, validate it and persist it to the
 *  uploads volume. Returns the public URL plus the buffer (for the Telegram post). */
async function saveMedia(
  value: FormDataEntryValue | null, exts: Record<string, string>, maxBytes: number, badTypeMsg: string, tooBigMsg: string,
): Promise<{ url: string; buf: Buffer; type: string; ext: string } | { error: string } | null> {
  if (!value || typeof value !== "object" || !("arrayBuffer" in value) || value.size === 0) return null;
  const ext = exts[value.type];
  if (!ext) return { error: badTypeMsg };
  if (value.size > maxBytes) return { error: tooBigMsg };
  const buf = Buffer.from(await value.arrayBuffer());
  ensureUploadDir();
  const name = `news-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return { url: `/api/uploads/${name}`, buf, type: value.type, ext };
}

/**
 * Publish a news announcement. The title is optional — a post can be text only.
 * The bot posts it to the Telegram channel automatically: as a photo or video with
 * a caption when media is attached, otherwise as a text message. The post is always
 * saved to the site even if Telegram fails or is not configured, so nothing is lost.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const form = await req.formData();
    const title = String(form.get("title") ?? "").trim(); // optional
    const body = String(form.get("body") ?? "").trim();
    if (!body) return jsonError(400, "Textul noutății este obligatoriu.");

    const image = await saveMedia(form.get("image"), IMAGE_EXT, MAX_IMAGE,
      "Format imagine neacceptat (JPG, PNG, WEBP sau GIF).", "Imaginea depășește 6 MB.");
    if (image && "error" in image) return jsonError(400, image.error);

    const video = await saveMedia(form.get("video"), VIDEO_EXT, MAX_VIDEO,
      "Format video neacceptat (MP4, WEBM sau MOV).", "Videoclipul depășește 48 MB.");
    if (video && "error" in video) return jsonError(400, video.error);

    // Auto-post to Telegram (best-effort — never blocks saving the post).
    const telegram: { posted: boolean; error?: string } = { posted: false };
    let tgUrl: string | null = null;
    if (telegramConfigured()) {
      const caption = (title ? `${title}\n\n${body}` : body).slice(0, CAPTION_MAX);
      // A video takes precedence as the Telegram attachment when both are present.
      const res = video
        ? await sendVideo(video.buf, caption, { filename: `noutate.${video.ext}`, type: video.type })
        : image
          ? await sendPhoto(image.buf, caption, { filename: `noutate.${image.ext}`, type: image.type })
          : await sendMessage(title ? `${title}\n\n${body}` : body);
      if (res.ok) { telegram.posted = true; tgUrl = res.url ?? null; }
      else telegram.error = res.error;
    } else {
      telegram.error = "Telegram nu este configurat — noutatea a fost salvată doar pe site.";
    }

    const id = db.prepare(
      "INSERT INTO news_posts (title, body, image_url, video_url, tg_url) VALUES (?,?,?,?,?)"
    ).run(title, body, image?.url ?? null, video?.url ?? null, tgUrl).lastInsertRowid;

    return NextResponse.json({ ok: true, id: Number(id), telegram });
  });
}
