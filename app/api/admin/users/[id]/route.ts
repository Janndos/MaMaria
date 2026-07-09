import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const id = Number(params.id);
    if (!id) return jsonError(400, "Utilizator invalid.");
    if (id === admin.id) return jsonError(400, "Nu vă puteți șterge propriul cont.");

    const target = db.prepare("SELECT id, role, phone FROM users WHERE id = ?").get(id) as
      { id: number; role: string; phone: string } | undefined;
    if (!target) return jsonError(404, "Utilizatorul nu a fost găsit.");
    if (target.role === "admin") return jsonError(403, "Conturile de administrator nu pot fi șterse de aici.");

    // Remove the user together with their orders (order_items cascade from orders)
    // and any OTP records for their phone.
    const tx = db.transaction(() => {
      db.prepare("DELETE FROM orders WHERE user_id = ?").run(id);
      db.prepare("DELETE FROM otp_codes WHERE phone = ?").run(target.phone);
      db.prepare("DELETE FROM users WHERE id = ?").run(id);
    });
    tx();
    return NextResponse.json({ ok: true });
  });
}
