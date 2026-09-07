import * as XLSX from "xlsx";
import { MAX_NAME, MAX_PRICE, parseNumeric } from "./products";

/* ============================================================================
 *  Parser for the kitchen software's product export ("Lista bucate.xlsx").
 *
 *  Reference layout — sheet "Лист1":
 *    A1  Номенклатура            (title, ignored)
 *    A2  (blank spacer)
 *    A3  Название | B3 Цена, lei | C3 Тип     ← header
 *    A4… data rows                            (Тип is always "Блюдо" → ignored)
 *
 *  Nothing above is assumed: every sheet is scanned for a row that looks like a
 *  header, and the columns are located by their titles, so a renamed sheet, an
 *  extra title row or a reordered/extra column still imports. Only the name and
 *  the price are taken — the catalogue stores nothing else.
 * ========================================================================== */

export type CatalogRow = { name: string; price: number };

/** A source row that could not be imported, with the reason and its Excel row number. */
export type SkippedRow = { row: number; name: string; reason: string };

export type CatalogParseResult = {
  rows: CatalogRow[];
  skipped: SkippedRow[];
  /** Rows dropped because the exact same name+price appeared earlier in the file. */
  duplicatesInFile: number;
  debug: {
    sheetName: string | null;
    /** 1-based spreadsheet row of the detected header, null when not found. */
    headerRow: number | null;
    columns: { name: number; price: number };
    dataRows: number;
  };
};

const NAME_HINTS = ["название", "наименование", "denumire", "denumirea", "nume", "produs", "name", "item"];
const PRICE_HINTS = ["цена", "цена, lei", "pret", "preț", "pretul", "price", "lei", "cost"];

function norm(v: unknown): string {
  return String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Does this cell title look like one of `hints`? Matches a prefix so "Цена, lei"
 *  is found by "цена" and "Preț porție" by "preț". */
function matches(cell: unknown, hints: string[]): boolean {
  const s = norm(cell);
  if (!s) return false;
  return hints.some((h) => s === h || s.startsWith(h));
}

/** Locate the header row and the name/price columns anywhere in a sheet. */
function findHeader(rows: unknown[][]): { headerRow: number; name: number; price: number } | null {
  const limit = Math.min(rows.length, 30); // the header is near the top in every export
  for (let r = 0; r < limit; r++) {
    const row = rows[r] ?? [];
    let name = -1;
    let price = -1;
    for (let c = 0; c < row.length; c++) {
      if (name === -1 && matches(row[c], NAME_HINTS)) name = c;
      else if (price === -1 && matches(row[c], PRICE_HINTS)) price = c;
    }
    if (name !== -1 && price !== -1) return { headerRow: r, name, price };
  }
  return null;
}

/**
 * Parse a product-catalogue workbook into name + price rows.
 *
 * Never throws on bad data: unusable rows are collected in `skipped` with a
 * reason so the admin sees exactly what was left out and why.
 */
export function parseCatalogXlsx(buf: Buffer): CatalogParseResult {
  const wb = XLSX.read(buf, { type: "buffer" });

  let best: { sheetName: string; rows: unknown[][]; header: { headerRow: number; name: number; price: number } } | null = null;
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
    const header = findHeader(rows);
    // Keep the sheet with the most data below its header — a workbook may carry
    // extra sheets (notes, totals) that also happen to have matching titles.
    if (header && (!best || rows.length - header.headerRow > best.rows.length - best.header.headerRow)) {
      best = { sheetName, rows, header };
    }
  }

  if (!best) {
    return {
      rows: [], skipped: [], duplicatesInFile: 0,
      debug: { sheetName: wb.SheetNames[0] ?? null, headerRow: null, columns: { name: -1, price: -1 }, dataRows: 0 },
    };
  }

  const { sheetName, rows, header } = best;
  const out: CatalogRow[] = [];
  const skipped: SkippedRow[] = [];
  const seen = new Set<string>();
  let duplicatesInFile = 0;
  let dataRows = 0;

  for (let r = header.headerRow + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const rawName = row[header.name];
    const rawPrice = row[header.price];
    const name = String(rawName ?? "").trim();
    const excelRow = r + 1; // 1-based, as shown in Excel

    // A blank name is a spacer or the end of the table — not worth reporting.
    if (!name) continue;
    dataRows++;

    if (name.length > MAX_NAME) {
      skipped.push({ row: excelRow, name: name.slice(0, 60) + "…", reason: `denumire prea lungă (${name.length} caractere)` });
      continue;
    }
    // An empty price cell is a gap in the export, not a genuine 0 — the real
    // zero-priced entries (dough, sauces) carry an actual 0.
    if (rawPrice === "" || rawPrice === null || rawPrice === undefined) {
      skipped.push({ row: excelRow, name, reason: "preț lipsă" });
      continue;
    }
    const price = parseNumeric(rawPrice);
    if (price === null) {
      skipped.push({ row: excelRow, name, reason: `preț invalid („${String(rawPrice).slice(0, 20)}")` });
      continue;
    }
    if (price > MAX_PRICE) {
      skipped.push({ row: excelRow, name, reason: `preț prea mare (${price})` });
      continue;
    }

    const rounded = Math.round((price + Number.EPSILON) * 100) / 100;
    const key = `${name}\u0000${rounded}`;
    if (seen.has(key)) { duplicatesInFile++; continue; }
    seen.add(key);
    out.push({ name, price: rounded });
  }

  return {
    rows: out, skipped, duplicatesInFile,
    debug: { sheetName, headerRow: header.headerRow + 1, columns: { name: header.name, price: header.price }, dataRows },
  };
}
