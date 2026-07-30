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
    // Optional created_at range (UTC "YYYY-MM-DD HH:MM:SS"), used by day printing.
    const from = sp.get("from");
    const to = sp.get("to");

    const where: string[] = [];
    const args: unknown[] = [];
    if (status) { where.push("o.status = ?"); args.push(status); }
    if (from) { where.push("o.created_at >= ?"); args.push(from); }
    if (to) { where.push("o.created_at < ?"); args.push(to); }

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
