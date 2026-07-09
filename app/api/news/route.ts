import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const posts = db.prepare("SELECT * FROM news_posts ORDER BY posted_at DESC LIMIT 20").all();
  return NextResponse.json({ posts });
}
