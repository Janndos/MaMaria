import { NextRequest, NextResponse } from "next/server";
import { countProducts, searchProducts } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { handle } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Search the product price list — the catalogue the manual menu builder pulls
 * from. Returns name + price only; the list holds no category or gram weight,
 * so the admin completes those fields after picking a product.
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
