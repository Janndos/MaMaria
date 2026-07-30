import { NextResponse } from "next/server";
import { getMenuByDate, getMenuItems, getStableItems, todayISO, getSetting } from "@/lib/db";
import { isWorkingDay, nowHHMM } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export async function GET() {
  const cutoff = getSetting("order_cutoff", "10:30");
  const ordersEnabled = getSetting("orders_enabled", "true") === "true";
  const now = new Date();
  const cutoffPassed = nowHHMM(now) > cutoff;
  const workingDay = isWorkingDay(now);

  // Stable items are available every day, independent of whether the daily menu
  // has been published yet.
  const stableItems = getStableItems(true);
  const menu = getMenuByDate(todayISO());
  if (!menu || !menu.published) {
    return NextResponse.json({ menu: null, items: [], stableItems, cutoff, ordersEnabled, cutoffPassed, workingDay });
  }
  return NextResponse.json({ menu, items: getMenuItems(menu.id), stableItems, cutoff, ordersEnabled, cutoffPassed, workingDay });
}
