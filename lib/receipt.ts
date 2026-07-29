import { locationLabel } from "./locations";

/* ============================================================================
 *  Printable kitchen receipts ("bonuri") for admin orders.
 *  ----------------------------------------------------------------------------
 *  Each order renders as a compact "check" sized to roughly 1/3 of an A4 page.
 *  Receipts flow down the page with `page-break-inside: avoid`, so printing a
 *  whole day tiles ~3 orders per A4 sheet, aligned for cutting. Printing happens
 *  in a throwaway popup window so the admin app chrome never appears on paper.
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
  return `${Number.isInteger(v) ? v : v.toFixed(2)} MDL`;
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
  return d.toLocaleString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** One receipt block. */
function receiptHtml(o: ReceiptOrder): string {
  const rows = o.items.map((it) => {
    const p = portion(it);
    return `<tr>
      <td class="q">${it.qty}×</td>
      <td class="n">${esc(it.name)}${p ? ` <span class="por">(${esc(p)})</span>` : ""}</td>
      <td class="a">${esc(money(it.price_mdl * it.qty))}</td>
    </tr>`;
  }).join("");

  const loc = o.pickup_location ? esc(locationLabel(o.pickup_location)) : "";

  return `<section class="receipt">
    <div class="head">
      <div class="brand">Ma&rsquo;Maria <span>Cafe &amp; Catering</span></div>
      <div class="onum">Comanda&nbsp;#${o.id}</div>
    </div>
    <div class="meta">
      <div><b>Client:</b> ${esc(o.full_name)}</div>
      <div><b>Telefon:</b> ${esc(o.phone)}</div>
      <div><b>Ridicare:</b> ${esc(o.pickup_time)}${loc ? ` · ${loc}` : ""}</div>
      <div><b>Plasată:</b> ${esc(placedAt(o.created_at))}</div>
    </div>
    <table class="items"><tbody>${rows}</tbody></table>
    <div class="total"><span>TOTAL</span><span>${esc(money(o.total_mdl))}</span></div>
    ${o.comment ? `<div class="note">„${esc(o.comment)}”</div>` : ""}
    <div class="cut">✂ ─────────────────────────────</div>
  </section>`;
}

const PRINT_CSS = `
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', 'Noto Sans', Arial, sans-serif; color: #14201f; font-size: 12px; }
  .receipt {
    width: 100%; min-height: 86mm; padding: 5mm 4mm 4mm; border-bottom: 1.5px dashed #9aa;
    page-break-inside: avoid; break-inside: avoid;
  }
  .receipt:last-child { border-bottom: none; }
  .head { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px;
    border-bottom: 2px solid #00818C; padding-bottom: 4px; }
  .brand { font-size: 18px; font-weight: 800; color: #00818C; line-height: 1; }
  .brand span { display: block; font-size: 9px; font-weight: 600; letter-spacing: 2px;
    text-transform: uppercase; color: #6b7a79; }
  .onum { font-size: 15px; font-weight: 800; white-space: nowrap; }
  .meta { margin-top: 6px; display: grid; grid-template-columns: 1fr 1fr; gap: 1px 12px; font-size: 11px; }
  .meta b { color: #55605f; font-weight: 600; }
  .items { width: 100%; border-collapse: collapse; margin-top: 6px; }
  .items td { padding: 2px 0; vertical-align: top; border-bottom: 1px dotted #dfe4e4; }
  .items .q { width: 30px; font-weight: 700; white-space: nowrap; }
  .items .n { padding-left: 4px; }
  .items .por { color: #8a9594; }
  .items .a { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; font-weight: 600; padding-left: 8px; }
  .total { display: flex; justify-content: space-between; margin-top: 6px; padding-top: 4px;
    border-top: 2px solid #14201f; font-size: 14px; font-weight: 800; }
  .note { margin-top: 4px; font-style: italic; color: #55605f; font-size: 11px; }
  .cut { margin-top: 6px; color: #9aa; font-size: 11px; letter-spacing: 1px; overflow: hidden; white-space: nowrap; }
`;

function buildDoc(orders: ReceiptOrder[], title: string): string {
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8">
    <title>${esc(title)}</title><style>${PRINT_CSS}</style></head>
    <body>${orders.map(receiptHtml).join("")}</body></html>`;
}

/**
 * Open a print window for one or more orders and trigger the browser print dialog.
 * Returns false if a popup blocker prevented the window (caller can surface a hint).
 */
export function printReceipts(orders: ReceiptOrder[], opts?: { title?: string }): boolean {
  if (typeof window === "undefined" || !orders.length) return false;
  const w = window.open("", "_blank", "width=820,height=1040");
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

/** Filter a list to orders created "today" (local time), oldest first — for the day batch. */
export function ordersForToday<T extends { created_at: string; id: number; status?: string }>(orders: T[]): T[] {
  const today = new Date().toDateString();
  return orders
    .filter((o) => new Date(`${o.created_at}Z`).toDateString() === today && o.status !== "cancelled")
    .sort((a, b) => a.id - b.id);
}
