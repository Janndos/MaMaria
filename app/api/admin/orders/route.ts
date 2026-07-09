import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const status = req.nextUrl.searchParams.get("status");
    const base = `
      SELECT o.*, u.full_name, u.phone
      FROM orders o JOIN users u ON u.id = o.user_id
      ${status ? "WHERE o.status = ?" : ""}
      ORDER BY o.id DESC LIMIT 200`;
    const orders = (status ? db.prepare(base).all(status) : db.prepare(base).all()) as any[];
    const itemsStmt = db.prepare("SELECT * FROM order_items WHERE order_id = ?");
    for (const o of orders) o.items = itemsStmt.all(o.id);
    return NextResponse.json({ orders });
  });
}
