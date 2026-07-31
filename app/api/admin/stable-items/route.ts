import { NextRequest, NextResponse } from "next/server";
import db, { getStableItems } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return NextResponse.json({ items: getStableItems(false) });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const { category, name, grams, unit, priceMdl, minQty, description, sortOrder } = await req.json();
    if (!name || !String(name).trim()) return jsonError(400, "Denumirea este obligatorie.");
    if (!(Number(priceMdl) > 0)) return jsonError(400, "Prețul este invalid.");
    const gramsVal = grams === "" || grams === null || grams === undefined ? null : Math.round(Number(grams));
    if (gramsVal !== null && !(gramsVal > 0)) return jsonError(400, "Gramajul este invalid.");
    const minQtyVal = minQty === undefined || minQty === "" || minQty === null ? 1 : Math.max(1, Math.round(Number(minQty)));
    if (!(minQtyVal >= 1)) return jsonError(400, "Cantitatea minimă este invalidă.");
    const desc = description === undefined || description === null ? null : (String(description).trim().slice(0, 600) || null);
    const max = db.prepare("SELECT COALESCE(MAX(sort_order),0) m FROM stable_items").get() as { m: number };
    const so = sortOrder === undefined || sortOrder === "" ? max.m + 1 : Math.round(Number(sortOrder));
    const id = db.prepare(
      `INSERT INTO stable_items (category, name, grams, unit, price_mdl, min_qty, description, sort_order)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run(
      String(category || "Bucate la comandă").trim(),
      String(name).trim(),
      gramsVal,
      String(unit || "buc").trim(),
      Number(priceMdl),
      minQtyVal,
      desc,
      so
    ).lastInsertRowid;
    return NextResponse.json({ ok: true, id: Number(id) });
  });
}
