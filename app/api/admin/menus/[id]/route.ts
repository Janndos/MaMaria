import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    await requireAdmin();
    const { published } = await req.json();
    const res = db.prepare("UPDATE menus SET published = ? WHERE id = ?").run(published ? 1 : 0, Number(params.id));
    if (!res.changes) return jsonError(404, "Meniul nu a fost găsit.");
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    await requireAdmin();
    db.prepare("DELETE FROM menus WHERE id = ?").run(Number(params.id));
    return NextResponse.json({ ok: true });
  });
}
