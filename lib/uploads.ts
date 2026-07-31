import fs from "fs";
import path from "path";

/** Uploaded product images live under the data volume so they survive redeploys
 *  (on Railway set DATA_DIR to the mounted volume — same place as the SQLite DB).
 *  They are served at runtime through /api/uploads/<file> (Next does not serve
 *  files written to public/ after build). */
export const UPLOAD_DIR = process.env.DATA_DIR
  ? path.join(path.resolve(process.env.DATA_DIR), "uploads")
  : path.join(process.cwd(), "data", "uploads");

export function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/** Only allow our own image basenames — blocks path traversal from clients. */
export function safeUploadPath(basename: string): string | null {
  if (!/^[\w.-]+\.(png|jpe?g|webp|gif)$/i.test(basename)) return null;
  const full = path.join(UPLOAD_DIR, basename);
  if (path.dirname(full) !== UPLOAD_DIR) return null;
  return full;
}

/** MIME → file extension for accepted image types. */
export const IMAGE_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** File extension → Content-Type for serving. */
export const CONTENT_TYPE: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
};
