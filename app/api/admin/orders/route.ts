import { NextRequest, NextResponse } from "next/server";
import db, { maybePruneOldOrders } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { handle } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireStaff();
    // Housekeeping: drop orders past the retention window (throttled to once/day).
    maybePruneOldOrders();

    const sp = req.nextUrl.searchParams;
    const status = sp.get("status");
    // Optional fulfillment-day filter (YYYY-MM-DD) — used by day printing. Falls
    // back to the created date for legacy orders that predate pickup_date.
    const pickupDate = sp.get("pickupDate");
    // Optional pickup-point filter (a PICKUP_LOCATIONS id, e.g. "draxlmaier-1").
    const location = sp.get("location");

    const where: string[] = [];
    const args: unknown[] = [];
    if (status) { where.push("o.status = ?"); args.push(status); }
    if (pickupDate) { where.push("COALESCE(o.pickup_date, date(o.created_at)) = ?"); args.push(pickupDate); }
    if (location) { where.push("o.pickup_location = ?"); args.push(location); }

    const sql = `
      SELECT o.*, u.full_name, u.phone
      FROM orders o JOIN users u ON u.id = o.user_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY o.id DESC LIMIT 500`;
    const orders = db.prepare(sql).all(...args) as any[];
    const itemsStmt = db.prepare("SELECT * FROM order_items WHERE order_id = ?");
    for (const o of orders) o.items = itemsStmt.all(o.id);
    return NextResponse.json({ orders });
  });
}
