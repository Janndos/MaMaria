import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const users = db.prepare(
      "SELECT id, full_name, phone, role, phone_verified, created_at FROM users ORDER BY id DESC LIMIT 500"
    ).all();
    return NextResponse.json({ users });
  });
}
