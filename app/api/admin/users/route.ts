import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { handle } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const actor = await requireStaff();
    const users = db.prepare(
      "SELECT id, full_name, phone, role, phone_verified, created_at FROM users ORDER BY id DESC LIMIT 500"
    ).all();
    // viewerRole lets the UI show admin-only actions (e.g. changing a user's role).
    return NextResponse.json({ users, viewerRole: actor.role });
  });
}
