import { locationLabel } from "./locations";

/* ============================================================================
 *  Printable kitchen checks ("bonuri") for admin orders.
 *  ----------------------------------------------------------------------------
 *  Day printing tiles orders into the FOUR equal quadrants of an A4 sheet, with a
 *  dashed cross down the middle as a cutting guide (4 checks per page). A single
 *  order prints as one narrow thermal-style check. Printing happens in a throwaway
 *  popup window so the admin app chrome never appears on paper.
 * ========================================================================== */

export type ReceiptItem = {
  id: number; name: string; grams: number; unit: string | null;
  price_mdl: number; qty: number; source_type?: string;
};
export type ReceiptOrder = {
  id: number; created_at: string; pickup_time: string; pickup_location: string | null;
  full_name: string; phone: string; comment: string | null; total_mdl: number; status?: string;
  pickup_date?: string | null;
  items: ReceiptItem[];
};

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function money(n: number): string {
  const v = typeof n === "number" && isFinite(n) ? n : 0;
  return v.toFixed(2);
}

function portion(it: ReceiptItem): string {
  if (it.grams && it.grams > 0) return `${it.grams} g`;
  if (it.unit) return `/${it.unit}`;
  return "";
}

function placedAt(created_at: string): string {
  const d = new Date(`${created_at}Z`);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("ro-RO", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function pickupDay(o: ReceiptOrder): string {
  if (!o.pickup_date) return "";
  const d = new Date(`${o.pickup_date}T12:00:00`);
  if (isNaN(d.getTime())) return o.pickup_date;
  return d.toLocaleDateString("ro-RO", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Inner check content (no outer frame — the frame/cut lines come from the layout). */
function checkHtml(o: ReceiptOrder): string {
  const items = o.items.map((it) => {
    const p = portion(it);
    return `<div class="it">
      <div class="l1"><b>${it.qty}×</b> ${esc(it.name)}</div>
      <div class="l2"><span>${esc(p)}</span><span>${esc(money(it.price_mdl * it.qty))}</span></div>
    </div>`;
  }).join("");

  const loc = o.pickup_location ? String(locationLabel(o.pickup_location)) : "";
  const [locName, locAddr] = loc ? loc.split(" · ") : ["", ""];
  const cancelled = o.status === "cancelled";
  const day = pickupDay(o);

  return `<div class="check">
    <div class="brand">Ma&rsquo;Maria</div>
    <div class="sub">CAFE &amp; CATERING</div>
    <div class="star"></div>
    <div class="onum">COMANDA #${o.id}${cancelled ? " — ANULATĂ" : ""}</div>
    <div class="star"></div>
    ${day ? `<div class="pickday">PENTRU: ${esc(day)}</div>` : ""}
    <div class="kv"><span>Client:</span><span>${esc(o.full_name)}</span></div>
    <div class="kv"><span>Tel:</span><span>${esc(o.phone)}</span></div>
    <div class="kv"><span>Plasată:</span><span>${esc(placedAt(o.created_at))}</span></div>
    <div class="dash"></div>
    <div class="pickup">RIDICARE: ${esc(o.pickup_time || "—")}</div>
    ${locName ? `<div class="loc">${esc(locName)}</div>` : ""}
    ${locAddr ? `<div class="loc small">${esc(locAddr)}</div>` : ""}
    <div class="dash"></div>
    <div class="items">${items}</div>
    <div class="dash"></div>
    <div class="total"><span>TOTAL</span><span>${esc(money(o.total_mdl))} MDL</span></div>
    ${o.comment ? `<div class="note">★ ${esc(o.comment)} ★</div>` : ""}
  </div>`;
}

const BASE_CSS = `
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: 'Courier New', 'Consolas', ui-monospace, monospace; color: #000; }
  .brand { text-align: center; font-weight: 700; letter-spacing: 1px; }
  .sub { text-align: center; letter-spacing: 3px; }
  .onum { text-align: center; font-weight: 700; }
  .star, .dash { overflow: hidden; white-space: nowrap; }
  .star::before { content: "************************************************************"; }
  .dash::before { content: "------------------------------------------------------------"; color: #444; }
  .pickday { text-align: center; font-weight: 700; }
  .kv { display: flex; gap: 8px; justify-content: space-between; }
  .kv span:first-child { color: #333; white-space: nowrap; }
  .kv span:last-child { text-align: right; word-break: break-word; }
  .pickup { text-align: center; font-weight: 700; }
  .loc { text-align: center; }
  .loc.small { color: #333; }
  .items { margin: 2px 0; }
  .it { margin: 1px 0; }
  .it .l2 { display: flex; justify-content: space-between; color: #333; padding-left: 14px; }
  .total { display: flex; justify-content: space-between; font-weight: 700; }
  .note { text-align: center; font-style: italic; }
`;

/* ---- single narrow check (per-order print) ---- */
const SINGLE_CSS = `
  @page { size: A4; margin: 8mm; }
  ${BASE_CSS}
  body { font-size: 12px; }
  .wrap { }
  .check { width: 74mm; margin: 0 auto 5mm; padding: 5mm; border: 1px dashed #888; page-break-inside: avoid; break-inside: avoid; line-height: 1.35; }
  .brand { font-size: 18px; } .sub { font-size: 9px; } .onum { font-size: 15px; }
  .star, .dash { height: 0.9em; line-height: 0.9em; margin: 3px 0; }
  .total { font-size: 14px; }
`;

/* ---- 2×2 quadrant layout (day print) ---- */
const QUAD_CSS = `
  @page { size: A4; margin: 7mm; }
  ${BASE_CSS}
  body { font-size: 10.5px; }
  .page {
    display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr;
    width: 100%; height: 283mm; /* A4 height − 2×7mm margins */
    page-break-after: always; break-after: page;
  }
  .page:last-child { page-break-after: auto; break-after: auto; }
  /* Dashed cross so all four quadrants can be cut apart. */
  .cell { padding: 5mm 5mm; overflow: hidden; }
  .cell.tl { border-right: 1.5px dashed #555; border-bottom: 1.5px dashed #555; }
  .cell.tr { border-bottom: 1.5px dashed #555; }
  .cell.bl { border-right: 1.5px dashed #555; }
  .check { line-height: 1.3; }
  .brand { font-size: 16px; } .sub { font-size: 8px; } .onum { font-size: 13px; }
  .star, .dash { height: 0.85em; line-height: 0.85em; margin: 2px 0; }
  .total { font-size: 12.5px; }
`;

function buildSingleDoc(orders: ReceiptOrder[], title: string): string {
  const body = orders.map((o) => checkHtml(o)).join("");
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8">
    <title>${esc(title)}</title><style>${SINGLE_CSS}</style></head><body>${body}</body></html>`;
}

const CELL_POS = ["tl", "tr", "bl", "br"];

function buildQuadDoc(orders: ReceiptOrder[], title: string): string {
  const pages: string[] = [];
  for (let i = 0; i < orders.length; i += 4) {
    const group = orders.slice(i, i + 4);
    const cells: string[] = [];
    for (let j = 0; j < 4; j++) {
      const pos = CELL_POS[j];
      cells.push(group[j]
        ? `<div class="cell ${pos}">${checkHtml(group[j])}</div>`
        : `<div class="cell ${pos}"></div>`); // keep the grid (and cross) complete
    }
    pages.push(`<div class="page">${cells.join("")}</div>`);
  }
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8">
    <title>${esc(title)}</title><style>${QUAD_CSS}</style></head><body>${pages.join("")}</body></html>`;
}

/**
 * Open a print window and trigger the browser print dialog.
 * `layout`: "quad" tiles 4 checks per A4 with a dashed cross (day print);
 *           "single" prints one narrow check per order. Defaults by count.
 * Returns false if a popup blocker prevented the window.
 */
export function printReceipts(orders: ReceiptOrder[], opts?: { title?: string; layout?: "quad" | "single" }): boolean {
  if (typeof window === "undefined" || !orders.length) return false;
  const layout = opts?.layout ?? (orders.length > 1 ? "quad" : "single");
  const w = window.open("", "_blank", "width=900,height=1040");
  if (!w) return false;
  const html = layout === "quad"
    ? buildQuadDoc(orders, opts?.title ?? "Comenzi Ma'Maria")
    : buildSingleDoc(orders, opts?.title ?? "Comenzi Ma'Maria");
  w.document.open();
  w.document.write(html);
  w.document.close();
  const fire = () => { try { w.focus(); w.print(); } catch { /* user closed it */ } };
  if (w.document.readyState === "complete") setTimeout(fire, 250);
  else w.onload = () => setTimeout(fire, 100);
  return true;
}

/** Prepare a batch for printing: drop cancelled orders and order oldest-first. */
export function preparePrintList<T extends { id: number; status?: string }>(orders: T[]): T[] {
  return orders.filter((o) => o.status !== "cancelled").sort((a, b) => a.id - b.id);
}
