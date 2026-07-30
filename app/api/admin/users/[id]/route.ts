import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TargetUser = { id: number; role: string; phone: string };

/**
 * PATCH updates a user:
 *  - { password }: staff resets a NEW password (passwords are bcrypt-hashed and
 *    can only be replaced, never viewed). tehno may only reset CUSTOMER accounts.
 *  - { role }: admin-only. Switches a user between "customer" and "tehno" (never
 *    grants "admin", and never touches an existing admin account).
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const actor = await requireStaff();
    const id = Number(params.id);
    if (!id) return jsonError(400, "Utilizator invalid.");
    const target = db.prepare("SELECT id, role, phone FROM users WHERE id = ?").get(id) as TargetUser | undefined;
    if (!target) return jsonError(404, "Utilizatorul nu a fost găsit.");

    const body = await req.json();

    if (body.role !== undefined) {
      if (actor.role !== "admin") return jsonError(403, "Doar administratorul poate schimba rolul.");
      const role = String(body.role);
      if (role !== "customer" && role !== "tehno") return jsonError(400, "Rol invalid.");
      if (target.role === "admin") return jsonError(403, "Rolul de administrator nu poate fi modificat de aici.");
      db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
      return NextResponse.json({ ok: true });
    }

    if (body.password !== undefined) {
      // tehno can help customers but must not touch staff accounts.
      if (actor.role !== "admin" && target.role !== "customer")
        return jsonError(403, "Nu puteți reseta parola unui cont de personal.");
      const pass = String(body.password ?? "");
      if (pass.length < 8) return jsonError(400, "Parola trebuie să aibă minim 8 caractere.");
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(bcrypt.hashSync(pass, 10), id);
      return NextResponse.json({ ok: true });
    }

    return jsonError(400, "Nimic de actualizat.");
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const actor = await requireStaff();
    const id = Number(params.id);
    if (!id) return jsonError(400, "Utilizator invalid.");
    if (id === actor.id) return jsonError(400, "Nu vă puteți șterge propriul cont.");

    const target = db.prepare("SELECT id, role, phone FROM users WHERE id = ?").get(id) as TargetUser | undefined;
    if (!target) return jsonError(404, "Utilizatorul nu a fost găsit.");
    if (target.role === "admin") return jsonError(403, "Conturile de administrator nu pot fi șterse de aici.");
    if (actor.role !== "admin" && target.role !== "customer")
      return jsonError(403, "Nu puteți șterge un cont de personal.");

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
