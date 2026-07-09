import * as XLSX from "xlsx";

export type ParsedItem = {
  num: number | null;
  category: string;
  name: string;
  grams: number | null;
  priceMdl: number | null;
  warnings: string[];
};

/** Debug-safe parsing diagnostics — surfaced in the API response and server logs
 *  so an "empty menu" upload can be diagnosed without guessing. */
export type ParseDebug = {
  sheetName: string | null;
  /** 1-based spreadsheet row number of the detected header, or null if not found. */
  headerRow: number | null;
  /** 0-based column indexes of the detected fields (-1 = not found). */
  columns: { num: number; category: number; name: number; grams: number; price: number };
  categoryCount: number;
  productCount: number;
};

export type ParseResult = { items: ParsedItem[]; errors: string[]; debug: ParseDebug };

const EMPTY_COLUMNS = { num: -1, category: -1, name: -1, grams: -1, price: -1 };

/** Weekday + date extracted from the top of the sheet, for the menu header. */
export type MenuMeta = { weekday: string | null; date: string | null; label: string };

const HEADER_HINTS = {
  num: ["nr", "no", "num", "#", "№", "n", "poz", "pozitie", "poziție"],
  category: ["categorie", "categoria", "category", "секция", "sectiune", "secțiune"],
  name: ["denumire", "denumirea", "nume", "produs", "fel", "name", "item"],
  grams: ["gramaj", "grame", "gram", "cantitate", "greutate", "masa", "вес", "грамм", "g", "gr", "weight"],
  price: ["pret", "preț", "pretul", "portie", "porție", "price", "mdl", "lei", "cost", "цена"],
};

function norm(s: unknown): string {
  return String(s ?? "").trim().toLowerCase()
    .replace(/ș/g, "s").replace(/ş/g, "s").replace(/ț/g, "t").replace(/ţ/g, "t")
    .replace(/ă/g, "a").replace(/â/g, "a").replace(/î/g, "i");
}

// Standard Ma'Maria menu sections. A row whose Denumire matches one of these (and
// carries no price) is always treated as a category heading, never a product —
// this keeps the kitchen's usual layout parsing cleanly even with stray cells.
const KNOWN_CATEGORIES = new Set([
  "felul intai", "felul i", "ciorbe", "supe",
  "garnitura", "garnituri",
  "bucate din carne", "bucate din peste", "fel de baza", "felul doi", "felul ii",
  "salate", "salata",
  "deserturi", "desert", "panificatie", "altele", "diverse", "bauturi", "lactate",
]);
function isKnownCategory(s: string): boolean {
  return KNOWN_CATEGORIES.has(norm(s));
}

function parseNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  const cleaned = String(v).replace(/[^\d.,\-]/g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : null;
}

/** Parse rows (array of arrays) into structured menu items. */
export function parseRows(rows: unknown[][], sheetName: string | null = null): ParseResult {
  const errors: string[] = [];
  const mkDebug = (headerRow: number | null, columns = { ...EMPTY_COLUMNS }, categoryCount = 0, productCount = 0): ParseDebug =>
    ({ sheetName, headerRow, columns, categoryCount, productCount });

  if (!rows.length) return { items: [], errors: ["Fișierul este gol."], debug: mkDebug(null) };

  // Locate the header row within the first 15 rows. We deliberately anchor on
  // "Denumire" (the product-name column): a row is only accepted as the header
  // once that column is present, which prevents title/category rows that happen
  // to contain fuzzy words like "fel" from being mistaken for the header.
  let headerIdx = -1;
  let cols: typeof EMPTY_COLUMNS = { ...EMPTY_COLUMNS };
  let fallbackIdx = -1;
  let fallbackCols: typeof EMPTY_COLUMNS = { ...EMPTY_COLUMNS };

  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = (rows[i] || []).map(norm);
    const found = { ...EMPTY_COLUMNS };
    cells.forEach((c, j) => {
      for (const key of Object.keys(HEADER_HINTS) as (keyof typeof HEADER_HINTS)[]) {
        if (found[key] === -1 && HEADER_HINTS[key].some((h) => c === h || (h.length > 2 && c.includes(h)))) {
          found[key] = j;
        }
      }
    });
    const hasDenumire = cells.some((c) => c.includes("denumire"));
    // Strong signal: an explicit "Denumire" header cell. Take it immediately.
    if (hasDenumire && found.name !== -1) { headerIdx = i; cols = found; break; }
    // Weak signal: name-like + a price/grams column. Remember as a fallback only.
    if (fallbackIdx === -1 && found.name !== -1 && (found.price !== -1 || found.grams !== -1)) {
      fallbackIdx = i; fallbackCols = found;
    }
  }
  if (headerIdx === -1 && fallbackIdx !== -1) { headerIdx = fallbackIdx; cols = fallbackCols; }

  if (headerIdx === -1) {
    return {
      items: [],
      errors: [
        "Nu am găsit rândul de antet. Fișierul trebuie să conțină coloanele Denumire, Masa/gr și Preț.",
      ],
      debug: mkDebug(null),
    };
  }
  if (cols.price === -1) errors.push("Coloana Preț nu a fost găsită — prețurile vor trebui completate manual.");
  if (cols.grams === -1) errors.push("Coloana Gramaj nu a fost găsită — gramajele vor trebui completate manual.");

  const items: ParsedItem[] = [];
  let currentCategory = "Diverse";

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const name = String(row[cols.name] ?? "").trim();
    const catCell = cols.category !== -1 ? String(row[cols.category] ?? "").trim() : "";
    const grams = cols.grams !== -1 ? parseNumber(row[cols.grams]) : null;
    const price = cols.price !== -1 ? parseNumber(row[cols.price]) : null;

    const rowEmpty = !name && !catCell && grams === null && price === null;
    if (rowEmpty) continue;

    // A row with only a name/category and no price is a section header — as is any
    // row whose text matches a known section name, even if a stray number slipped in.
    const headingText = catCell || name;
    const looksLikeHeading = (name || catCell) && grams === null && price === null;
    if (looksLikeHeading || (price === null && isKnownCategory(headingText))) {
      currentCategory = headingText.replace(/[:：]+$/, "").trim();
      continue;
    }
    if (!name) {
      const num = cols.num !== -1 ? parseNumber(row[cols.num]) : null;
      const ref = num !== null ? `Produsul nr. ${num}` : `Rândul ${i + 1}`;
      errors.push(`${ref}: lipsește denumirea — rând ignorat.`);
      continue;
    }
    if (catCell) currentCategory = catCell;

    const num = cols.num !== -1 ? parseNumber(row[cols.num]) : null;
    const warnings: string[] = [];
    if (grams === null) warnings.push("gramaj lipsă");
    else if (grams <= 0 || grams > 2000) warnings.push("gramaj neobișnuit");
    if (price === null) warnings.push("preț lipsă");
    else if (price <= 0 || price > 500) warnings.push("preț neobișnuit");

    items.push({ num, category: currentCategory, name, grams, priceMdl: price, warnings });
  }

  if (!items.length) errors.push("Nu am putut extrage niciun produs din fișier.");
  const categoryCount = new Set(items.map((it) => it.category)).size;
  return { items, errors, debug: mkDebug(headerIdx + 1, cols, categoryCount, items.length) };
}

/** Read the first worksheet of a workbook as a row matrix, along with its name. */
function firstSheetRows(buf: Buffer): { rows: unknown[][]; sheetName: string | null } {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheetName = wb.SheetNames[0] ?? null;
  const sheet = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!sheet) return { rows: [], sheetName };
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
  return { rows, sheetName };
}

export function parseXlsx(buf: Buffer): ParseResult {
  const { rows, sheetName } = firstSheetRows(buf);
  if (!rows.length && sheetName === null) {
    return { items: [], errors: ["Fișierul Excel nu conține nicio foaie de calcul."], debug: { sheetName: null, headerRow: null, columns: { ...EMPTY_COLUMNS }, categoryCount: 0, productCount: 0 } };
  }
  return parseRows(rows, sheetName);
}

/* ---------- menu header (weekday + date) ---------- */
const WEEKDAYS: Record<string, { display: string; dow: number }> = {
  luni: { display: "LUNI", dow: 1 },
  marti: { display: "MARȚI", dow: 2 },
  miercuri: { display: "MIERCURI", dow: 3 },
  joi: { display: "JOI", dow: 4 },
  vineri: { display: "VINERI", dow: 5 },
  sambata: { display: "SÂMBĂTĂ", dow: 6 },
  duminica: { display: "DUMINICĂ", dow: 0 },
};
const WEEKDAY_BY_DOW = Object.values(WEEKDAYS).reduce<Record<number, string>>((m, w) => ((m[w.dow] = w.display), m), {});

function excelSerialToDate(serial: number): Date | null {
  // Excel epoch is 1899-12-30 (accounts for the 1900 leap-year bug for serials ≥ 60).
  if (!isFinite(serial) || serial < 20000 || serial > 80000) return null;
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
}
function fmtDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

/** Scan the first rows (above the table header) for a weekday word and a date
 *  (Excel serial or DD.MM.YYYY string). Robust to their exact cell position. */
export function extractMenuMeta(rows: unknown[][]): MenuMeta {
  let weekday: string | null = null;
  let date: string | null = null;
  let parsedDate: Date | null = null;

  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    for (const cell of rows[i] || []) {
      if (cell === null || cell === undefined || cell === "") continue;
      // Weekday word
      if (!weekday && typeof cell === "string") {
        const key = norm(cell);
        if (WEEKDAYS[key]) weekday = WEEKDAYS[key].display;
      }
      // Date: Excel serial number
      if (!parsedDate && typeof cell === "number") {
        const d = excelSerialToDate(cell);
        if (d) { parsedDate = d; date = fmtDate(d); }
      }
      // Date: DD.MM.YYYY / DD.MM.YY string
      if (!parsedDate && typeof cell === "string") {
        const m = cell.trim().match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})\b/);
        if (m) {
          const dd = +m[1], mm = +m[2]; let yy = +m[3];
          if (yy < 100) yy += 2000;
          const d = new Date(Date.UTC(yy, mm - 1, dd));
          if (!isNaN(d.getTime())) { parsedDate = d; date = fmtDate(d); }
        }
      }
    }
  }

  // Derive the weekday from the date when it wasn't written explicitly.
  if (!weekday && parsedDate) weekday = WEEKDAY_BY_DOW[parsedDate.getUTCDay()] ?? null;

  const label = [weekday, date].filter(Boolean).join(" ").trim();
  return { weekday, date, label };
}

/** Full menu parse for image/PDF generation: items + weekday/date header. */
export function parseXlsxMenu(buf: Buffer): ParseResult & { meta: MenuMeta } {
  const { rows, sheetName } = firstSheetRows(buf);
  if (!rows.length && sheetName === null) {
    return {
      items: [],
      errors: ["Fișierul Excel nu conține nicio foaie de calcul."],
      debug: { sheetName: null, headerRow: null, columns: { ...EMPTY_COLUMNS }, categoryCount: 0, productCount: 0 },
      meta: { weekday: null, date: null, label: "" },
    };
  }
  return { ...parseRows(rows, sheetName), meta: extractMenuMeta(rows) };
}

/** CSV parser tolerant to ; or , delimiters and quoted fields (Moldovan Excel exports use ;). */
export function parseCsv(text: string): ParseResult {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delim) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return parseRows(rows);
}
