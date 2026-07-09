import { NextResponse } from "next/server";
import { getMenuByDate, getMenuItems, getStableItems, todayISO, getSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const cutoff = getSetting("order_cutoff", "10:30");
  const ordersEnabled = getSetting("orders_enabled", "true") === "true";
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const cutoffPassed = hhmm > cutoff;

  // Stable items are available every day, independent of whether the daily menu
  // has been published yet.
  const stableItems = getStableItems(true);
  const menu = getMenuByDate(todayISO());
  if (!menu || !menu.published) {
    return NextResponse.json({ menu: null, items: [], stableItems, cutoff, ordersEnabled, cutoffPassed });
  }
  return NextResponse.json({ menu, items: getMenuItems(menu.id), stableItems, cutoff, ordersEnabled, cutoffPassed });
}
