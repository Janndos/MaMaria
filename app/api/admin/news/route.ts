import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const { title, body, imageUrl, tgUrl } = await req.json();
    if (!title || !body) return jsonError(400, "Titlul și textul sunt obligatorii.");
    const id = db.prepare(
      "INSERT INTO news_posts (title, body, image_url, tg_url) VALUES (?,?,?,?)"
    ).run(String(title).trim(), String(body).trim(), imageUrl || null, tgUrl || null).lastInsertRowid;
    return NextResponse.json({ ok: true, id: Number(id) });
  });
}
