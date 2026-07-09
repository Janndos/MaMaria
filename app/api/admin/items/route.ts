import { NextRequest, NextResponse } from "next/server";
import db, { ensureCategory } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const { menuId, category, name, grams, priceMdl } = await req.json();
    if (!menuId || !name || !(Number(grams) > 0) || !(Number(priceMdl) > 0))
      return jsonError(400, "Completați denumirea, gramajul și prețul.");
    const catId = ensureCategory(String(category || "Diverse"));
    const max = db.prepare("SELECT COALESCE(MAX(sort_order),0) m FROM menu_items WHERE menu_id = ?").get(Number(menuId)) as { m: number };
    const id = db.prepare(
      "INSERT INTO menu_items (menu_id, category_id, name, grams, price_mdl, sort_order) VALUES (?,?,?,?,?,?)"
    ).run(Number(menuId), catId, String(name).trim(), Math.round(Number(grams)), Number(priceMdl), max.m + 1).lastInsertRowid;
    return NextResponse.json({ ok: true, id: Number(id) });
  });
}
