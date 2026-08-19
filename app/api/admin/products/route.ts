import { NextRequest, NextResponse } from "next/server";
import db, { countProducts, searchProducts } from "@/lib/db";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { readProductBody } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Search the product price list — the catalogue the manual menu builder pulls
 * from, and the Catalog screen edits. Returns name, price and portion weight
 * (0 when nobody has filled the weight in yet). Categories are never stored here,
 * so the admin always supplies the category when building a menu.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireStaff();
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q") ?? "";
    // The picker pulls the WHOLE catalogue once and filters in the browser, so the
    // admin always sees every product and typing never waits on the network.
    const limit = Math.min(Math.max(Number(sp.get("limit")) || 50, 1), 5000);
    return NextResponse.json({ products: searchProducts(q, limit), total: countProducts() });
  });
}

/** Add a product to the price list. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const parsed = readProductBody(await req.json());
    if (typeof parsed === "string") return jsonError(400, parsed);
    const { name, price, grams } = parsed;
    const id = db.prepare("INSERT INTO products (name, price, grams) VALUES (?,?,?)")
      .run(name, price, grams).lastInsertRowid;
    return NextResponse.json({ ok: true, product: { id: Number(id), name, price, grams } });
  });
}
