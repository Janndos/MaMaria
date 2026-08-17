import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { safeUploadPath, CONTENT_TYPE } from "@/lib/uploads";

export const runtime = "nodejs";       // reads files from disk (fs) — never Edge
export const dynamic = "force-dynamic"; // files are written at runtime

/** Serve an uploaded media file (product image, news image or video) from the data volume.
 *  Byte ranges are honoured — Safari/iOS will not play a <video> whose source does
 *  not answer a Range request with 206. */
export async function GET(req: NextRequest, { params }: { params: { file: string } }) {
  const full = safeUploadPath(String(params.file ?? ""));
  if (!full || !fs.existsSync(full)) {
    return NextResponse.json({ error: "Fișierul nu a fost găsit." }, { status: 404 });
  }
  const ext = path.extname(full).slice(1).toLowerCase();
  const type = CONTENT_TYPE[ext] ?? "application/octet-stream";
  const size = fs.statSync(full).size;

  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || end < start) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const chunk = Buffer.alloc(end - start + 1);
    const fd = fs.openSync(full, "r");
    try { fs.readSync(fd, chunk, 0, chunk.length, start); } finally { fs.closeSync(fd); }
    return new NextResponse(chunk, {
      status: 206,
      headers: {
        "Content-Type": type,
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  const buf = fs.readFileSync(full);
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Content-Length": String(buf.length),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
