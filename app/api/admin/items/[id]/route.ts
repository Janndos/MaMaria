import { NextRequest, NextResponse } from "next/server";
import db, { ensureCategory } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json();
    const id = Number(params.id);
    const item = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(id) as any;
    if (!item) return jsonError(404, "Produsul nu a fost găsit.");
    const catId = body.category !== undefined ? ensureCategory(String(body.category)) : item.category_id;
    db.prepare(
      "UPDATE menu_items SET name = ?, grams = ?, price_mdl = ?, available = ?, category_id = ? WHERE id = ?"
    ).run(
      body.name !== undefined ? String(body.name).trim() : item.name,
      body.grams !== undefined ? Math.round(Number(body.grams)) : item.grams,
      body.priceMdl !== undefined ? Number(body.priceMdl) : item.price_mdl,
      body.available !== undefined ? (body.available ? 1 : 0) : item.available,
      catId, id
    );
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    await requireAdmin();
    db.prepare("DELETE FROM menu_items WHERE id = ?").run(Number(params.id));
    return NextResponse.json({ ok: true });
  });
}
