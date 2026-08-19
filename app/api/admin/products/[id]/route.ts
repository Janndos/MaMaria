import { NextRequest, NextResponse } from "next/server";
import db, { getProductById } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { readProductBody } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Edit one price-list product (name, price, portion weight). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    await requireAdmin();
    const id = Number(params.id);
    const existing = getProductById(id);
    if (!existing) return jsonError(404, "Produsul nu a fost găsit.");

    const body = await req.json();
    // Fields left out of the request keep their current value.
    const parsed = readProductBody({
      name: body?.name ?? existing.name,
      price: body?.price ?? existing.price,
      grams: body?.grams ?? existing.grams,
    });
    if (typeof parsed === "string") return jsonError(400, parsed);

    const { name, price, grams } = parsed;
    db.prepare("UPDATE products SET name = ?, price = ?, grams = ? WHERE id = ?").run(name, price, grams, id);
    return NextResponse.json({ ok: true, product: { id, name, price, grams } });
  });
}

/** Remove a product from the price list. Menus already built keep their own copy
 *  of the name/grams/price, so deleting here never changes a published menu. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    await requireAdmin();
    const info = db.prepare("DELETE FROM products WHERE id = ?").run(Number(params.id));
    if (!info.changes) return jsonError(404, "Produsul nu a fost găsit.");
    return NextResponse.json({ ok: true });
  });
}
