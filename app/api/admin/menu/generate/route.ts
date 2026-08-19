import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getMenuByDate, getMenuItems } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { metaFromISODate, parseXlsxMenu, type MenuMeta, type ParsedItem } from "@/lib/parse";
import { generateMenuAssets } from "@/lib/menu-render";
import { ensureGeneratedDir, GENERATED_DIR, pruneGenerated } from "@/lib/media";
import { sendPhoto, sendDocument } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // uses fs + @resvg/resvg-js (native) — never Edge

/**
 * Generate the branded menu sheet (PNG + PDF) and optionally post it to Telegram.
 *
 * Two sources, one response shape so the admin UI treats them identically:
 *   multipart/form-data  → an uploaded .xlsx is parsed  (`file`, `post`, `includePdf`)
 *   application/json     → a menu already saved in the DB (`date`, `post`, `includePdf`),
 *                          i.e. one the admin built by hand in "Încarcă meniul".
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const ct = req.headers.get("content-type") ?? "";
    return ct.includes("application/json") ? fromSavedMenu(req) : fromXlsx(req);
  });
}

/* -------------------------------------------------------------------------- */
/*  Source: a menu saved in the database (built by hand in the admin panel)    */
/* -------------------------------------------------------------------------- */

async function fromSavedMenu(req: NextRequest) {
  const { date, post, includePdf } = await req.json();
  const iso = String(date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso))
    return jsonError(400, "Data meniului este invalidă (format AAAA-LL-ZZ).");

  const menu = getMenuByDate(iso);
  if (!menu) return jsonError(404, `Nu există niciun meniu salvat pentru ${iso}.`);

  const rows = getMenuItems(menu.id);
  if (!rows.length) return jsonError(400, "Meniul salvat nu conține niciun produs.");

  // The stored rows already come back grouped by category and in display order.
  // № is renumbered 1..N so the printed sheet reads continuously.
  const items: ParsedItem[] = rows.map((r, i) => ({
    num: i + 1,
    category: r.category || "Diverse",
    name: r.name,
    grams: r.grams ?? null,
    priceMdl: r.price_mdl ?? null,
    warnings: [],
  }));

  return renderStoreAndRespond(items, metaFromISODate(iso), {
    post: post === true || post === "1",
    includePdf: includePdf === true || includePdf === "1",
    logLabel: `saved menu ${iso}`,
  });
}

/* -------------------------------------------------------------------------- */
/*  Source: an uploaded .xlsx                                                  */
/* -------------------------------------------------------------------------- */

async function fromXlsx(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const post = form.get("post") === "1";
  const includePdf = form.get("includePdf") === "1";

  if (!(file instanceof File)) return jsonError(400, "Atașați un fișier .xlsx.");
  if (!file.name.toLowerCase().endsWith(".xlsx")) return jsonError(400, "Format neacceptat. Încărcați un fișier .xlsx.");
  if (file.size > 5 * 1024 * 1024) return jsonError(400, "Fișierul depășește 5 MB.");

  // ---- parse (graceful on malformed files) ----
  let parsed;
  try {
    parsed = parseXlsxMenu(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    console.error("Menu xlsx parse failed:", e);
    return jsonError(400, "Fișierul Excel nu a putut fi citit. Verificați formatul (.xlsx).");
  }

  // Debug-safe parsing diagnostics — logged on the server AND returned to the
  // admin UI so an "empty menu" upload can be diagnosed at a glance.
  const debug = {
    sheet: parsed.debug.sheetName,
    headerRow: parsed.debug.headerRow,
    columns: parsed.debug.columns,
    categories: parsed.debug.categoryCount,
    products: parsed.debug.productCount,
    warnings: parsed.errors,
  };
  console.log("[menu/generate] parse result:", JSON.stringify({ file: file.name, ...debug }));

  // Never render or post an empty menu — fail loudly instead.
  if (!parsed.items.length) {
    return NextResponse.json(
      {
        error:
          "Nu s-a găsit niciun produs în acest fișier Excel. Verificați formatul fișierului (foaie, antet Denumire, coloane Masa/gr și Preț).",
        debug,
      },
      { status: 400 },
    );
  }

  return renderStoreAndRespond(parsed.items, parsed.meta, {
    post, includePdf, debug, warnings: parsed.errors, logLabel: file.name,
  });
}

/* -------------------------------------------------------------------------- */
/*  Shared: render → validate → store → optionally post → respond              */
/* -------------------------------------------------------------------------- */

type RenderOpts = {
  post: boolean;
  includePdf: boolean;
  /** Excel-only parse diagnostics, echoed back to the admin UI. */
  debug?: Record<string, unknown>;
  warnings?: string[];
  logLabel: string;
};

async function renderStoreAndRespond(items: ParsedItem[], meta: MenuMeta, opts: RenderOpts) {
  const { post, includePdf, debug, warnings = [], logLabel } = opts;

  let assets;
  try {
    assets = await generateMenuAssets(items, meta);
  } catch (e) {
    console.error("Menu render failed:", e);
    return jsonError(500, "Nu am putut genera imaginea meniului.");
  }

  // Render diagnostics — logged and (for the Excel path) surfaced to the admin UI.
  if (debug) {
    Object.assign(debug, {
      weekday: meta.weekday, date: meta.date,
      svgLength: assets.svgLength, fontsFound: assets.fontsFound,
    });
  }
  console.log("[menu/generate] render result:", JSON.stringify({
    source: logLabel,
    weekday: meta.weekday,
    date: meta.date,
    items: items.length,
    svgLength: assets.svgLength,
    fontsFound: assets.fontsFound,
    fontFiles: assets.fontFiles,
    size: `${assets.width}x${assets.height}`,
  }));

  // Guard: the rendered template must contain its header text. If it doesn't,
  // something is badly wrong with generation — don't store or post it.
  if (!assets.containsExpectedText) {
    console.error("[menu/generate] rendered SVG missing expected header text (MENIU/Denumire).");
    return NextResponse.json(
      { error: "Imaginea meniului a fost generată incorect (antet lipsă). Încercați din nou.", debug },
      { status: 500 },
    );
  }
  if (!assets.fontsFound) {
    console.error("[menu/generate] bundled fonts missing — refusing to post a menu with unrenderable text.");
    return NextResponse.json(
      { error: "Fonturile pentru generarea imaginii lipsesc pe server (public/fonts). Contactați administratorul.", debug },
      { status: 500 },
    );
  }

  // ---- store under public/generated ----
  ensureGeneratedDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const base = `menu-${stamp}`;
  const pngName = `${base}.png`;
  const pdfName = `${base}.pdf`;
  fs.writeFileSync(path.join(GENERATED_DIR, pngName), assets.png);
  fs.writeFileSync(path.join(GENERATED_DIR, pdfName), assets.pdf);
  pruneGenerated(40); // keep only the most recent files

  const caption = meta.label ? `Meniul zilei – ${meta.label}` : "Meniul zilei";

  // ---- optional immediate Telegram post ----
  let telegram: { posted: boolean; error?: string } | undefined;
  if (post) {
    const photo = await sendPhoto(assets.png, caption);
    if (photo.ok && includePdf) await sendDocument(assets.pdf, `${caption}.pdf`, undefined);
    telegram = photo.ok ? { posted: true } : { posted: false, error: photo.error };
  }

  return NextResponse.json({
    ok: true,
    image: pngName,
    pdf: pdfName,
    imageUrl: `/api/generated/${pngName}`,
    pdfUrl: `/api/generated/${pdfName}`,
    meta,
    caption,
    itemCount: items.length,
    warnings,
    debug,
    telegram,
  });
}
