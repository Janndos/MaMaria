import { NextRequest, NextResponse } from "next/server";
import db, { ensureCategory, getMenuByDate, getMenuItems } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const date = req.nextUrl.searchParams.get("date");
    if (date) {
      const menu = getMenuByDate(date);
      return NextResponse.json({ menu: menu ?? null, items: menu ? getMenuItems(menu.id) : [] });
    }
    const menus = db.prepare("SELECT * FROM menus ORDER BY date DESC LIMIT 60").all();
    return NextResponse.json({ menus });
  });
}

/** Create/replace a menu for a date from a list of items (upload-preview publish or manual save). */
export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const { date, title, items, publish } = await req.json();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date)))
      return jsonError(400, "Data meniului este invalidă (format AAAA-LL-ZZ).");
    if (!Array.isArray(items) || !items.length)
      return jsonError(400, "Meniul nu conține niciun produs.");
    for (const it of items) {
      if (!it.name || !String(it.name).trim()) return jsonError(400, "Fiecare produs trebuie să aibă o denumire.");
      if (!(Number(it.grams) > 0)) return jsonError(400, `„${it.name}": gramaj invalid.`);
      if (!(Number(it.priceMdl) > 0)) return jsonError(400, `„${it.name}": preț invalid.`);
    }

    const tx = db.transaction(() => {
      const existing = getMenuByDate(String(date));
      let menuId: number;
      if (existing) {
        menuId = existing.id;
        db.prepare("DELETE FROM menu_items WHERE menu_id = ?").run(menuId);
        db.prepare("UPDATE menus SET title = ?, published = ? WHERE id = ?")
          .run(title || "Meniul zilei", publish ? 1 : existing.published, menuId);
      } else {
        menuId = Number(db.prepare("INSERT INTO menus (date, title, published) VALUES (?,?,?)")
          .run(String(date), title || "Meniul zilei", publish ? 1 : 0).lastInsertRowid);
      }
      const ins = db.prepare(
        "INSERT INTO menu_items (menu_id, category_id, name, grams, price_mdl, available, sort_order) VALUES (?,?,?,?,?,?,?)"
      );
      items.forEach((it: any, i: number) => {
        const catId = ensureCategory(String(it.category || "Diverse"));
        ins.run(menuId, catId, String(it.name).trim(), Math.round(Number(it.grams)), Number(it.priceMdl), it.available === false ? 0 : 1, i);
      });
      return menuId;
    });
    const menuId = tx();
    return NextResponse.json({ ok: true, menuId });
  });
}
