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
const FONT = "'Segoe UI','Helvetica Neue','DejaVu Sans','Arial',sans-serif";

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

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
  return p === null ? "" : p.toFixed(2).replace(".", ",");
}
function fmtGrams(g: number | null): string {
  return g === null ? "" : String(Math.round(g));
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
  type RRow = { kind: "cat" | "item" | "spacer"; item?: ParsedItem; category?: string };
  const rrows: RRow[] = [];
  groups.forEach((g) => {
    rrows.push({ kind: "cat", category: g.category });
    g.items.forEach((it) => rrows.push({ kind: "item", item: it }));
    rrows.push({ kind: "spacer" });
  });

  const headerBottom = tableTop + HEADER_H;
  const bodyH = rrows.length * ROW_H;
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
    const baseline = y + ROW_H / 2 + 7;
    if (r.kind === "cat") {
      parts.push(`<text x="${COL_NUM_R + 12}" y="${baseline}" font-family="${FONT}" font-size="21" font-weight="700" fill="${INK}">${esc(r.category!)}</text>`);
    } else if (r.kind === "item" && r.item) {
      const it = r.item;
      if (it.num !== null) parts.push(`<text x="${(TABLE_L + COL_NUM_R) / 2}" y="${baseline}" text-anchor="middle" font-family="${FONT}" font-size="20" fill="${INK}">${esc(String(Math.round(it.num)))}</text>`);
      parts.push(`<text x="${COL_NUM_R + 12}" y="${baseline}" font-family="${FONT}" font-size="20" fill="${INK}">${esc(it.name)}</text>`);
      if (it.grams !== null) parts.push(`<text x="${midGrams}" y="${baseline}" text-anchor="middle" font-family="${FONT}" font-size="20" fill="${INK}">${esc(fmtGrams(it.grams))}</text>`);
      if (it.priceMdl !== null) parts.push(`<text x="${TABLE_R - 14}" y="${baseline}" text-anchor="end" font-family="${FONT}" font-size="20" fill="${INK}">${esc(fmtPrice(it.priceMdl))}</text>`);
    }
    y += ROW_H;
    parts.push(`<line x1="${TABLE_L}" y1="${y}" x2="${TABLE_R}" y2="${y}" stroke="${BORDER}" stroke-width="1"/>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}">${parts.join("")}</svg>`;
  return { svg, width: W, height };
}

/** Rasterize the SVG to a PNG buffer (2× for crisp text/lines). */
export function svgToPng(svg: string, designWidth: number): Buffer {
  const resvg = new Resvg(svg, {
    background: "white",
    fitTo: { mode: "width", value: designWidth * 2 },
    font: { loadSystemFonts: true, defaultFontFamily: "Segoe UI" },
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

/** End-to-end: parsed items + meta → { png, pdf }. */
export async function generateMenuAssets(items: ParsedItem[], meta: MenuMeta): Promise<{ png: Buffer; pdf: Buffer; width: number; height: number }> {
  const groups = groupItems(items);
  const { svg, width, height } = buildMenuSvg(meta, groups);
  const png = svgToPng(svg, width);
  const pdf = await pngToPdf(png);
  return { png, pdf, width, height };
}
