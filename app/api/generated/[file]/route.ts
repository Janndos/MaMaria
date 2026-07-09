import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { safeGeneratedPath } from "@/lib/media";

export const runtime = "nodejs";       // reads files from disk (fs) — never Edge
export const dynamic = "force-dynamic"; // files are written at runtime

/**
 * Serve a generated menu asset (PNG/PDF) from disk.
 *
 * Files are written to public/generated at RUNTIME, but Next's production server
 * only serves `public/` files that existed at build time — so `/generated/<file>`
 * 404s on Railway. Streaming them through this route reads the current file from
 * disk on every request, which works regardless of when it was created.
 */
export async function GET(_req: NextRequest, { params }: { params: { file: string } }) {
  const full = safeGeneratedPath(String(params.file ?? ""));
  if (!full || !fs.existsSync(full)) {
    return NextResponse.json({ error: "Fișierul generat nu a fost găsit." }, { status: 404 });
  }

  const buf = fs.readFileSync(full);
  const isPdf = full.toLowerCase().endsWith(".pdf");
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": isPdf ? "application/pdf" : "image/png",
      "Content-Length": String(buf.length),
      "Content-Disposition": `inline; filename="${params.file}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
