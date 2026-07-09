import fs from "fs";
import path from "path";
import { Resvg } from "@resvg/resvg-js";
import { PDFDocument } from "pdf-lib";
import type { ParsedItem, MenuMeta } from "./parse";

/* ============================================================================
 *  Branded menu renderer  (Excel → SVG template → PNG + PDF)
 *  ----------------------------------------------------------------------------
 *  Fully backend-driven & deterministic: we build an SVG that mirrors the
 *  printed Ma'Maria sheet (logo, "MENIU", weekday+date, teal table header,
 *  category sections), rasterize it to PNG with resvg, then wrap that PNG into
 *  a single-page PDF with pdf-lib. No headless browser, no Excel screenshotting.
 * ========================================================================== */

const BRAND_TEAL = "#00818C";
const INK = "#1E2A2B";
const BORDER = "#c9d2d2";
const HAIRLINE = "#d9dede";
// All text uses the font we BUNDLE with the app (public/fonts/NotoSans-*.ttf) so
// rendering never depends on system fonts — the cause of blank text on Railway.
// "Noto Sans" covers the Romanian diacritics ă â î ș ț; the generic keyword is a
// last-resort fallback only.
const FONT = "'Noto Sans',sans-serif";
const FONT_FAMILY = "Noto Sans";

// Layout constants (design units; rasterized at 2× for crispness).
const W = 1000;
const M = 44;                 // page margin
const TABLE_L = M;
const TABLE_R = W - M;        // 956
const COL_NUM_R = 112;        // № column right edge
const COL_NAME_R = 728;       // Denumire right edge
const COL_GRAMS_R = 828;      // Masa/gr right edge  (price = COL_GRAMS_R..TABLE_R)
const HEADER_H = 78;
const ROW_H = 42;
const NAME_LINE_H = 24;             // line height when a product name wraps
const NAME_X = COL_NUM_R + 12;      // left edge of the Denumire text
const NAME_MAX_W = COL_NAME_R - NAME_X - 10; // usable width for the name column

/** Escape for SVG text — accepts anything and never throws on null/undefined. */
function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Word-wrap a product name to fit the Denumire column, at most `maxLines`.
 *  Width is estimated from the font size (no font metrics available in SVG). */
function wrapName(name: unknown, fontSize: number, maxLines = 2): string[] {
  const clean = String(name ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return [""];
  const maxChars = Math.max(8, Math.floor(NAME_MAX_W / (fontSize * 0.55)));
  const words = clean.split(" ");
  const lines: string[] = [];
  let cur = "";
  let truncated = false;
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (trial.length <= maxChars || !cur) {
      cur = trial;
    } else if (lines.length < maxLines - 1) {
      lines.push(cur);
      cur = w;
    } else {
      truncated = true; // ran out of lines — remaining words are dropped
      break;
    }
  }
  if (cur) lines.push(cur);
  if (truncated && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && last.length + 1 > maxChars) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.replace(/[\s.]+$/, "")}…`;
  }
  return lines.length ? lines : [""];
}

type Group = { category: string; items: ParsedItem[] };

/** Group items by category, preserving first-seen order. */
export function groupItems(items: ParsedItem[]): Group[] {
  const groups: Group[] = [];
  const byCat = new Map<string, Group>();
  for (const it of items) {
    let g = byCat.get(it.category);
    if (!g) { g = { category: it.category, items: [] }; byCat.set(it.category, g); groups.push(g); }
    g.items.push(it);
  }
  return groups;
}

function readLogoDataUri(): string | null {
  const custom = process.env.MENU_LOGO_PATH;
  const candidates = [
    custom,
    path.join(process.cwd(), "public", "logo.png"),
    path.join(process.cwd(), "public", "logo_M.png"),
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const ext = path.extname(p).toLowerCase() === ".jpg" || path.extname(p).toLowerCase() === ".jpeg" ? "jpeg" : "png";
        return `data:image/${ext};base64,${fs.readFileSync(p).toString("base64")}`;
      }
    } catch { /* ignore and try next */ }
  }
  return null;
}

function fmtPrice(p: number | null): string {
  return typeof p === "number" && isFinite(p) ? p.toFixed(2).replace(".", ",") : "";
}
function fmtGrams(g: number | null): string {
  return typeof g === "number" && isFinite(g) ? String(Math.round(g)) : "";
}

/** Build the menu SVG and its pixel dimensions. */
export function buildMenuSvg(meta: MenuMeta, groups: Group[]): { svg: string; width: number; height: number } {
  const logo = readLogoDataUri();
  const parts: string[] = [];

  // --- header block geometry ---
  const logoW = 250, logoH = 150, logoY = 44;
  const titleY = logoY + logoH + 58;           // "MENIU" baseline
  const subtitleY = titleY + 46;               // weekday + date baseline
  const line1Y = logoY + logoH + 16;
  const line2Y = subtitleY + 26;
  const tableTop = line2Y + 34;

  // --- build render rows (category header + items + trailing spacer) ---
  // Each row carries its own height so long, wrapped product names get extra space.
  type RRow = { kind: "cat" | "item" | "spacer"; item?: ParsedItem; category?: string; nameLines?: string[]; height: number };
  const rrows: RRow[] = [];
  groups.forEach((g) => {
    rrows.push({ kind: "cat", category: g.category, height: ROW_H });
    g.items.forEach((it) => {
      const nameLines = wrapName(it.name, 20);
      const height = Math.max(ROW_H, nameLines.length * NAME_LINE_H + 16);
      rrows.push({ kind: "item", item: it, nameLines, height });
    });
    rrows.push({ kind: "spacer", height: ROW_H });
  });

  const headerBottom = tableTop + HEADER_H;
  const bodyH = rrows.reduce((sum, r) => sum + r.height, 0);
  const tableBottom = headerBottom + bodyH;
  const height = Math.round(tableBottom + 44);

  // background
  parts.push(`<rect x="0" y="0" width="${W}" height="${height}" fill="#ffffff"/>`);

  // logo
  if (logo) {
    parts.push(`<image x="${(W - logoW) / 2}" y="${logoY}" width="${logoW}" height="${logoH}" href="${logo}" preserveAspectRatio="xMidYMid meet"/>`);
  }

  // title + subtitle + hairlines
  parts.push(`<line x1="${TABLE_L}" y1="${line1Y}" x2="${TABLE_R}" y2="${line1Y}" stroke="${HAIRLINE}" stroke-width="1.5"/>`);
  parts.push(`<text x="${W / 2}" y="${titleY}" text-anchor="middle" font-family="${FONT}" font-size="46" font-weight="700" letter-spacing="2" fill="${INK}">MENIU</text>`);
  if (meta.label) {
    parts.push(`<text x="${W / 2}" y="${subtitleY}" text-anchor="middle" font-family="${FONT}" font-size="34" font-weight="700" fill="${INK}">${esc(meta.label)}</text>`);
  }
  parts.push(`<line x1="${TABLE_L}" y1="${line2Y}" x2="${TABLE_R}" y2="${line2Y}" stroke="${HAIRLINE}" stroke-width="1.5"/>`);

  // --- table header (teal) ---
  parts.push(`<rect x="${TABLE_L}" y="${tableTop}" width="${TABLE_R - TABLE_L}" height="${HEADER_H}" fill="${BRAND_TEAL}"/>`);
  const midName = (COL_NUM_R + COL_NAME_R) / 2;
  const midGrams = (COL_NAME_R + COL_GRAMS_R) / 2;
  const midPrice = (COL_GRAMS_R + TABLE_R) / 2;
  const hMid = tableTop + HEADER_H / 2;
  const hLabel = (x: number, y: number, s: string, size = 20) =>
    `<text x="${x}" y="${y}" text-anchor="middle" font-family="${FONT}" font-size="${size}" font-weight="700" fill="#ffffff">${esc(s)}</text>`;
  parts.push(hLabel((TABLE_L + COL_NUM_R) / 2, hMid + 7, "№"));
  parts.push(hLabel(midName, hMid + 7, "Denumire"));
  parts.push(hLabel(midGrams, hMid - 4, "Masa/", 18));
  parts.push(hLabel(midGrams, hMid + 20, "gr", 18));
  parts.push(hLabel(midPrice, hMid - 4, "Preț porție,", 18));
  parts.push(hLabel(midPrice, hMid + 20, "MDL", 18));

  // --- grid lines (verticals span the body; horizontals per row) ---
  const xs = [TABLE_L, COL_NUM_R, COL_NAME_R, COL_GRAMS_R, TABLE_R];
  for (const x of xs) {
    parts.push(`<line x1="${x}" y1="${tableTop}" x2="${x}" y2="${tableBottom}" stroke="${BORDER}" stroke-width="1"/>`);
  }
  parts.push(`<line x1="${TABLE_L}" y1="${tableTop}" x2="${TABLE_R}" y2="${tableTop}" stroke="${BORDER}" stroke-width="1"/>`);
  parts.push(`<line x1="${TABLE_L}" y1="${headerBottom}" x2="${TABLE_R}" y2="${headerBottom}" stroke="${BORDER}" stroke-width="1"/>`);

  // --- body rows ---
  let y = headerBottom;
  for (const r of rrows) {
    const midBaseline = y + r.height / 2 + 7; // vertical centre for single-line cells
    if (r.kind === "cat") {
      parts.push(`<text x="${NAME_X}" y="${midBaseline}" font-family="${FONT}" font-size="21" font-weight="700" fill="${INK}">${esc(r.category ?? "")}</text>`);
    } else if (r.kind === "item" && r.item) {
      const it = r.item;
      if (it.num !== null && it.num !== undefined)
        parts.push(`<text x="${(TABLE_L + COL_NUM_R) / 2}" y="${midBaseline}" text-anchor="middle" font-family="${FONT}" font-size="20" fill="${INK}">${esc(String(Math.round(it.num)))}</text>`);
      // product name — one or more wrapped lines, vertically centred
      const lines = r.nameLines && r.nameLines.length ? r.nameLines : [String(it.name ?? "")];
      const firstY = y + r.height / 2 - ((lines.length - 1) * NAME_LINE_H) / 2 + 7;
      lines.forEach((ln, li) => {
        parts.push(`<text x="${NAME_X}" y="${firstY + li * NAME_LINE_H}" font-family="${FONT}" font-size="20" fill="${INK}">${esc(ln)}</text>`);
      });
      if (it.grams !== null && it.grams !== undefined)
        parts.push(`<text x="${midGrams}" y="${midBaseline}" text-anchor="middle" font-family="${FONT}" font-size="20" fill="${INK}">${esc(fmtGrams(it.grams))}</text>`);
      if (it.priceMdl !== null && it.priceMdl !== undefined)
        parts.push(`<text x="${TABLE_R - 14}" y="${midBaseline}" text-anchor="end" font-family="${FONT}" font-size="20" fill="${INK}">${esc(fmtPrice(it.priceMdl))}</text>`);
    }
    y += r.height;
    parts.push(`<line x1="${TABLE_L}" y1="${y}" x2="${TABLE_R}" y2="${y}" stroke="${BORDER}" stroke-width="1"/>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}">${parts.join("")}</svg>`;
  return { svg, width: W, height };
}

/** Locate the bundled Noto Sans font files that ship with the app. Rendering uses
 *  these exclusively so it never depends on system fonts (the cause of blank text
 *  on Railway). An optional MENU_FONT_DIR override and an assets/fonts fallback are
 *  probed too. Returns the files found and whether the bundle is present. */
export function resolveMenuFonts(): { files: string[]; found: boolean } {
  const dirs = [
    process.env.MENU_FONT_DIR,                       // explicit override (dir)
    path.join(process.cwd(), "public", "fonts"),     // bundled with the app (primary)
    path.join(process.cwd(), "assets", "fonts"),     // alternate bundle location
  ].filter(Boolean) as string[];

  const files: string[] = [];
  for (const dir of dirs) {
    try {
      for (const f of fs.readdirSync(dir)) {
        if (/\.(ttf|otf|ttc)$/i.test(f)) files.push(path.join(dir, f));
      }
    } catch { /* directory not present — skip */ }
  }
  return { files, found: files.length > 0 };
}

/** Rasterize the SVG to a PNG buffer (2× for crisp text/lines). Uses the bundled
 *  Noto Sans; falls back to system fonts with a loud warning only if the bundle is
 *  missing, so an image is never silently produced with unrenderable text. */
export function svgToPng(svg: string, designWidth: number, fonts = resolveMenuFonts()): Buffer {
  if (!fonts.found) {
    console.warn(
      "[menu-render] WARNING: bundled fonts not found (expected public/fonts/NotoSans-Regular.ttf & NotoSans-Bold.ttf). " +
        "Text may render blank. Falling back to system fonts.",
    );
  }
  const resvg = new Resvg(svg, {
    background: "white",
    fitTo: { mode: "width", value: designWidth * 2 },
    font: {
      // When the bundle is present, load ONLY it (deterministic, no system dep).
      loadSystemFonts: !fonts.found,
      fontFiles: fonts.found ? fonts.files : undefined,
      defaultFontFamily: FONT_FAMILY,
      sansSerifFamily: FONT_FAMILY,
    },
  });
  return Buffer.from(resvg.render().asPng());
}

/** Wrap the PNG into a single A4-width PDF page (image scaled to fit width). */
export async function pngToPdf(png: Buffer): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const img = await doc.embedPng(png);
  const pageW = 595.28; // A4 width in points
  const scale = pageW / img.width;
  const pageH = img.height * scale;
  const page = doc.addPage([pageW, pageH]);
  page.drawImage(img, { x: 0, y: 0, width: pageW, height: pageH });
  return Buffer.from(await doc.save());
}

export type MenuAssets = {
  png: Buffer; pdf: Buffer; width: number; height: number;
  svgLength: number; fontsFound: boolean; fontFiles: string[];
  /** True if the rendered template contains its expected header text. */
  containsExpectedText: boolean;
};

/** End-to-end: parsed items + meta → PNG + PDF plus render diagnostics. */
export async function generateMenuAssets(items: ParsedItem[], meta: MenuMeta): Promise<MenuAssets> {
  const groups = groupItems(items);
  const { svg, width, height } = buildMenuSvg(meta, groups);
  const fonts = resolveMenuFonts();
  const png = svgToPng(svg, width, fonts);
  const pdf = await pngToPdf(png);
  const containsExpectedText = svg.includes("MENIU") && svg.includes("Denumire");
  return {
    png, pdf, width, height,
    svgLength: svg.length,
    fontsFound: fonts.found,
    fontFiles: fonts.files,
    containsExpectedText,
  };
}
