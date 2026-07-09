import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handle } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    await requireAdmin();
    db.prepare("DELETE FROM news_posts WHERE id = ?").run(Number(params.id));
    return NextResponse.json({ ok: true });
  });
}
