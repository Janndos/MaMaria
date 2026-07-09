import { NextRequest, NextResponse } from "next/server";
import db, { getStableItemById } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    await requireAdmin();
    const id = Number(params.id);
    const item = getStableItemById(id);
    if (!item) return jsonError(404, "Produsul nu a fost găsit.");
    const body = await req.json();

    let grams = item.grams;
    if (body.grams !== undefined) {
      grams = body.grams === "" || body.grams === null ? null : Math.round(Number(body.grams));
      if (grams !== null && !(grams > 0)) return jsonError(400, "Gramajul este invalid.");
    }
    let price = item.price_mdl;
    if (body.priceMdl !== undefined) {
      price = Number(body.priceMdl);
      if (!(price > 0)) return jsonError(400, "Prețul este invalid.");
    }

    db.prepare(
      `UPDATE stable_items
       SET category = ?, name = ?, grams = ?, unit = ?, price_mdl = ?, available = ?, sort_order = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      body.category !== undefined ? String(body.category).trim() : item.category,
      body.name !== undefined ? String(body.name).trim() : item.name,
      grams,
      body.unit !== undefined ? String(body.unit).trim() : item.unit,
      price,
      body.available !== undefined ? (body.available ? 1 : 0) : item.available,
      body.sortOrder !== undefined ? Math.round(Number(body.sortOrder)) : item.sort_order,
      id
    );
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    await requireAdmin();
    db.prepare("DELETE FROM stable_items WHERE id = ?").run(Number(params.id));
    return NextResponse.json({ ok: true });
  });
}
