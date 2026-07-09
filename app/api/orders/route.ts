import { NextRequest, NextResponse } from "next/server";
import db, { getMenuByDate, todayISO, getSetting, getStableItemById, MenuItem, StableItem } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { findLocation } from "@/lib/locations";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const orders = db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 50").all(user.id) as any[];
    const itemsStmt = db.prepare("SELECT * FROM order_items WHERE order_id = ?");
    for (const o of orders) o.items = itemsStmt.all(o.id);
    return NextResponse.json({ orders });
  });
}

type ResolvedLine = {
  source: "daily" | "stable"; id: number; name: string;
  grams: number; unit: string | null; price: number; qty: number;
};

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    if (!user.phone_verified) return jsonError(403, "Confirmați numărul de telefon înainte de a comanda.");

    const { items, pickupTime, pickupLocation, comment } = await req.json();
    if (!Array.isArray(items) || items.length === 0)
      return jsonError(400, "Coșul este gol.");
    if (!pickupTime || !/^\d{2}:\d{2}$/.test(String(pickupTime)))
      return jsonError(400, "Alegeți ora de ridicare.");
    const location = findLocation(String(pickupLocation ?? ""));
    if (!location) return jsonError(400, "Alegeți un punct de ridicare valid.");

    // Manual kill-switch takes priority over the daily cutoff — different message for each.
    if (getSetting("orders_enabled", "true") !== "true")
      return jsonError(403, "Momentan nu preluăm comenzi. Te rugăm să revii mai târziu.");

    const cutoff = getSetting("order_cutoff", "10:30");
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    if (hhmm > cutoff)
      return jsonError(400, "Comenzile pentru azi s-au închis.");

    // Only load / require the daily menu if the cart actually contains daily items.
    const hasDaily = items.some((l: any) => (l.source ?? "daily") === "daily");
    const menu = hasDaily ? getMenuByDate(todayISO()) : null;
    if (hasDaily && (!menu || !menu.published))
      return jsonError(400, "Meniul de azi nu este publicat încă.");

    const getDaily = db.prepare("SELECT * FROM menu_items WHERE id = ? AND menu_id = ?");
    let total = 0;
    const resolved: ResolvedLine[] = [];
    for (const line of items) {
      const qty = Math.floor(Number(line.qty));
      if (!qty || qty < 1 || qty > 20) return jsonError(400, "Cantitate invalidă.");
      const source = (line.source ?? "daily") === "stable" ? "stable" : "daily";

      if (source === "stable") {
        const item = getStableItemById(Number(line.id)) as StableItem | undefined;
        if (!item) return jsonError(400, "Un produs din coș nu mai există.");
        if (!item.available) return jsonError(400, `„${item.name}" nu mai este disponibil.`);
        total += item.price_mdl * qty;
        resolved.push({ source, id: item.id, name: item.name, grams: item.grams ?? 0, unit: item.unit, price: item.price_mdl, qty });
      } else {
        const item = getDaily.get(Number(line.id), menu!.id) as MenuItem | undefined;
        if (!item) return jsonError(400, "Un produs din coș nu mai există în meniul de azi.");
        if (!item.available) return jsonError(400, `„${item.name}" nu mai este disponibil azi.`);
        total += item.price_mdl * qty;
        resolved.push({ source, id: item.id, name: item.name, grams: item.grams, unit: null, price: item.price_mdl, qty });
      }
    }

    const tx = db.transaction(() => {
      const orderId = Number(db.prepare(
        "INSERT INTO orders (user_id, status, total_mdl, pickup_time, pickup_location, comment) VALUES (?,?,?,?,?,?)"
      ).run(user.id, "pending", total, String(pickupTime), location.id, comment ? String(comment).slice(0, 500) : null).lastInsertRowid);
      const ins = db.prepare(
        "INSERT INTO order_items (order_id, menu_item_id, source_type, name, grams, unit, price_mdl, qty) VALUES (?,?,?,?,?,?,?,?)"
      );
      for (const r of resolved) ins.run(orderId, r.id, r.source, r.name, r.grams, r.unit, r.price, r.qty);
      return orderId;
    });
    const orderId = tx();
    return NextResponse.json({ ok: true, orderId, total });
  });
}
