import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { safeUploadPath, CONTENT_TYPE } from "@/lib/uploads";

export const runtime = "nodejs";       // reads files from disk (fs) — never Edge
export const dynamic = "force-dynamic"; // files are written at runtime

/** Serve an uploaded product image from the data volume. */
export async function GET(_req: NextRequest, { params }: { params: { file: string } }) {
  const full = safeUploadPath(String(params.file ?? ""));
  if (!full || !fs.existsSync(full)) {
    return NextResponse.json({ error: "Imaginea nu a fost găsită." }, { status: 404 });
  }
  const buf = fs.readFileSync(full);
  const ext = path.extname(full).slice(1).toLowerCase();
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": CONTENT_TYPE[ext] ?? "application/octet-stream",
      "Content-Length": String(buf.length),
      "Cache-Control": "public, max-age=86400",
    },
  });
}
