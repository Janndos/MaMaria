import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { requireAdmin } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { safeGeneratedPath } from "@/lib/media";
import { sendPhoto, sendDocument, telegramConfigured } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // reads files from disk (fs) — never Edge

/** Post an already-generated menu image (and optionally the PDF) to Telegram. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    if (!telegramConfigured())
      return jsonError(400, "Telegram nu este configurat. Setați TELEGRAM_BOT_TOKEN și TELEGRAM_CHAT_ID.");

    const { image, pdf, caption, includePdf } = await req.json();

    const imgPath = safeGeneratedPath(String(image ?? ""));
    if (!imgPath || !fs.existsSync(imgPath)) return jsonError(400, "Imaginea generată nu a fost găsită. Generați meniul din nou.");

    const cap = String(caption ?? "Meniul zilei").slice(0, 1024);
    const photo = await sendPhoto(fs.readFileSync(imgPath), cap);
    if (!photo.ok) return jsonError(502, photo.error);

    if (includePdf && pdf) {
      const pdfPath = safeGeneratedPath(String(pdf));
      if (pdfPath && fs.existsSync(pdfPath)) {
        await sendDocument(fs.readFileSync(pdfPath), `${cap}.pdf`);
      }
    }
    return NextResponse.json({ ok: true });
  });
}
