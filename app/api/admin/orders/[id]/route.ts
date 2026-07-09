import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";

const STATUSES = ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    await requireAdmin();
    const { status, cancellationReason } = await req.json();
    if (!STATUSES.includes(status)) return jsonError(400, "Status invalid.");

    if (status === "cancelled") {
      const reason = String(cancellationReason ?? "").trim();
      if (!reason) return jsonError(400, "Introduceți motivul anulării.");
      const res = db.prepare(
        "UPDATE orders SET status = ?, cancellation_reason = ? WHERE id = ?"
      ).run(status, reason.slice(0, 500), Number(params.id));
      if (!res.changes) return jsonError(404, "Comanda nu a fost găsită.");
      return NextResponse.json({ ok: true });
    }

    // Moving to any other status clears a previous cancellation note so the
    // customer no longer sees a stale reason if an order is reopened.
    const res = db.prepare(
      "UPDATE orders SET status = ?, cancellation_reason = NULL WHERE id = ?"
    ).run(status, Number(params.id));
    if (!res.changes) return jsonError(404, "Comanda nu a fost găsită.");
    return NextResponse.json({ ok: true });
  });
}
