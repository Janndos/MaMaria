import fs from "fs";
import path from "path";

/** Generated menu assets live under public/generated so they are downloadable /
 *  previewable at /generated/<file>. (This app runs as a long-lived Node server,
 *  so writing into public/ at runtime is served correctly.) */
export const GENERATED_DIR = path.join(process.cwd(), "public", "generated");

export function ensureGeneratedDir() {
  if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

/** Only allow our own generated basenames — blocks path traversal from clients. */
export function safeGeneratedPath(basename: string): string | null {
  if (!/^menu-[\w-]+\.(png|pdf)$/.test(basename)) return null;
  const full = path.join(GENERATED_DIR, basename);
  if (path.dirname(full) !== GENERATED_DIR) return null;
  return full;
}

/** Keep only the newest `keep` files (png+pdf) so the folder can't grow forever. */
export function pruneGenerated(keep = 40) {
  try {
    const files = fs.readdirSync(GENERATED_DIR)
      .filter((f) => /^menu-.*\.(png|pdf)$/.test(f))
      .map((f) => ({ f, t: fs.statSync(path.join(GENERATED_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const { f } of files.slice(keep)) {
      try { fs.unlinkSync(path.join(GENERATED_DIR, f)); } catch { /* ignore */ }
    }
  } catch { /* folder may not exist yet */ }
}
