import { locationLabel } from "./locations";

/* ============================================================================
 *  Printable kitchen checks ("bonuri") for admin orders.
 *  ----------------------------------------------------------------------------
 *  Each order renders as a narrow, vertical thermal-style receipt (like a store
 *  check) — monospace, centered header, dashed separators — so it can be cut out
 *  and stuck on the order bag / used at the stove. Checks are a fixed narrow width
 *  centred on the page and flow down with `page-break-inside: avoid`, so a whole
 *  day tiles ~3 checks per A4 sheet, aligned for cutting. Printing happens in a
 *  throwaway popup window so the admin app chrome never appears on paper.
 * ========================================================================== */

export type ReceiptItem = {
  id: number; name: string; grams: number; unit: string | null;
  price_mdl: number; qty: number; source_type?: string;
};
export type ReceiptOrder = {
  id: number; created_at: string; pickup_time: string; pickup_location: string | null;
  full_name: string; phone: string; comment: string | null; total_mdl: number; status?: string;
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
  // created_at is stored UTC; render in the viewer's local (Moldova) time.
  const d = new Date(`${created_at}Z`);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("ro-RO", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** One narrow check block. */
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

  return `<section class="check">
    <div class="brand">Ma&rsquo;Maria</div>
    <div class="sub">CAFE &amp; CATERING</div>
    <div class="star"></div>
    <div class="onum">COMANDA #${o.id}${cancelled ? " — ANULATĂ" : ""}</div>
    <div class="star"></div>
    <div class="kv"><span>Data:</span><span>${esc(placedAt(o.created_at))}</span></div>
    <div class="kv"><span>Client:</span><span>${esc(o.full_name)}</span></div>
    <div class="kv"><span>Tel:</span><span>${esc(o.phone)}</span></div>
    <div class="dash"></div>
    <div class="pickup">RIDICARE: ${esc(o.pickup_time || "—")}</div>
    ${locName ? `<div class="loc">${esc(locName)}</div>` : ""}
    ${locAddr ? `<div class="loc small">${esc(locAddr)}</div>` : ""}
    <div class="dash"></div>
    <div class="items">${items}</div>
    <div class="dash"></div>
    <div class="total"><span>TOTAL</span><span>${esc(money(o.total_mdl))} MDL</span></div>
    ${o.comment ? `<div class="dash"></div><div class="note">★ ${esc(o.comment)} ★</div>` : ""}
    <div class="star"></div>
    <div class="foot">mamaria.md · Mulțumim!</div>
  </section>`;
}

const PRINT_CSS = `
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: 'Courier New', 'Consolas', ui-monospace, monospace; color: #000; }
  .check {
    width: 74mm; margin: 0 auto 5mm; padding: 5mm 5mm 4mm;
    border: 1px dashed #888; min-height: 84mm;
    font-size: 12px; line-height: 1.35; page-break-inside: avoid; break-inside: avoid;
  }
  .brand { text-align: center; font-size: 20px; font-weight: 700; letter-spacing: 1px; }
  .sub { text-align: center; font-size: 10px; letter-spacing: 3px; margin-top: 1px; }
  .onum { text-align: center; font-size: 15px; font-weight: 700; }
  /* Full-width character rules that clip to the check width */
  .star, .dash { overflow: hidden; white-space: nowrap; height: 0.9em; line-height: 0.9em; margin: 3px 0; }
  .star::before { content: "************************************************************"; }
  .dash::before { content: "------------------------------------------------------------"; color: #444; }
  .kv { display: flex; gap: 8px; justify-content: space-between; }
  .kv span:first-child { color: #333; white-space: nowrap; }
  .kv span:last-child { text-align: right; word-break: break-word; }
  .pickup { text-align: center; font-weight: 700; font-size: 13px; }
  .loc { text-align: center; }
  .loc.small { font-size: 10px; color: #333; }
  .items { margin: 2px 0; }
  .it { margin: 2px 0; }
  .it .l1 { }
  .it .l2 { display: flex; justify-content: space-between; color: #333; font-size: 11px; padding-left: 14px; }
  .total { display: flex; justify-content: space-between; font-weight: 700; font-size: 14px; }
  .note { text-align: center; font-style: italic; }
  .foot { text-align: center; font-size: 10px; color: #333; margin-top: 2px; }
`;

function buildDoc(orders: ReceiptOrder[], title: string): string {
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8">
    <title>${esc(title)}</title><style>${PRINT_CSS}</style></head>
    <body>${orders.map(checkHtml).join("")}</body></html>`;
}

/**
 * Open a print window for one or more orders and trigger the browser print dialog.
 * Returns false if a popup blocker prevented the window (caller can surface a hint).
 */
export function printReceipts(orders: ReceiptOrder[], opts?: { title?: string }): boolean {
  if (typeof window === "undefined" || !orders.length) return false;
  const w = window.open("", "_blank", "width=520,height=900");
  if (!w) return false;
  w.document.open();
  w.document.write(buildDoc(orders, opts?.title ?? "Comenzi Ma'Maria"));
  w.document.close();
  // Let the popup lay out before invoking print (content is static HTML/CSS).
  const fire = () => { try { w.focus(); w.print(); } catch { /* user closed it */ } };
  if (w.document.readyState === "complete") setTimeout(fire, 250);
  else w.onload = () => setTimeout(fire, 100);
  return true;
}

/** Prepare a batch for printing: drop cancelled orders and order oldest-first. */
export function preparePrintList<T extends { id: number; status?: string }>(orders: T[]): T[] {
  return orders.filter((o) => o.status !== "cancelled").sort((a, b) => a.id - b.id);
}
