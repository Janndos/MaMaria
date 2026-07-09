import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return NextResponse.json({
      orderCutoff: getSetting("order_cutoff", "10:30"),
      ordersEnabled: getSetting("orders_enabled", "true") === "true",
      telegramUrl: getSetting("telegram_url", "https://t.me/mamaria_md"),
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json();

    if (body.orderCutoff !== undefined) {
      if (!/^\d{2}:\d{2}$/.test(String(body.orderCutoff))) return jsonError(400, "Format oră invalid (HH:MM).");
      setSetting("order_cutoff", String(body.orderCutoff));
    }
    if (body.ordersEnabled !== undefined) {
      setSetting("orders_enabled", body.ordersEnabled ? "true" : "false");
    }
    if (body.telegramUrl !== undefined) {
      const url = String(body.telegramUrl).trim();
      if (url && !/^https:\/\//.test(url)) return jsonError(400, "Linkul trebuie să înceapă cu https://");
      setSetting("telegram_url", url || "https://t.me/mamaria_md");
    }
    return NextResponse.json({ ok: true });
  });
}
