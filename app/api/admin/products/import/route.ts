import { NextRequest, NextResponse } from "next/server";
import db, { type Product } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handle, jsonError } from "@/lib/api";
import { parseCatalogXlsx } from "@/lib/parse-catalog";
import { planImport } from "@/lib/catalog-import";
import { readProductBody } from "@/lib/products";

export const runtime = "nodejs"; // xlsx + better-sqlite3 — never Edge
export const dynamic = "force-dynamic";

const MAX_FILE = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS = 20_000;          // a sane ceiling for a kitchen price list

function currentProducts(): Product[] {
  return db.prepare("SELECT id, name, price, grams FROM products").all() as Product[];
}

/**
 * STEP 1 — upload the kitchen software's export and see what it would change.
 * Writes nothing: returns the plan (new rows, price changes, ambiguities) so the
 * admin can confirm before anything touches the catalogue.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError(400, "Atașați un fișier .xlsx.");
    if (!/\.(xlsx|xls)$/i.test(file.name)) return jsonError(400, "Format neacceptat. Încărcați un fișier .xlsx.");
    if (file.size > MAX_FILE) return jsonError(400, "Fișierul depășește 5 MB.");

    let parsed;
    try {
      parsed = parseCatalogXlsx(Buffer.from(await file.arrayBuffer()));
    } catch (e) {
      console.error("[products/import] xlsx parse failed:", e);
      return jsonError(400, "Fișierul Excel nu a putut fi citit. Verificați formatul (.xlsx).");
    }

    if (parsed.debug.headerRow === null) {
      return NextResponse.json({
        error:
          "Nu am găsit capul de tabel în acest fișier. Este nevoie de o coloană de denumire " +
          "(«Название» / «Denumire») și una de preț («Цена» / «Preț»).",
        debug: parsed.debug,
      }, { status: 400 });
    }
    if (parsed.rows.length > MAX_ROWS) return jsonError(400, `Fișierul conține prea multe rânduri (${parsed.rows.length}).`);

    const plan = planImport(parsed.rows, currentProducts());
    console.log("[products/import] preview:", JSON.stringify({
      file: file.name, ...parsed.debug,
      parsed: parsed.rows.length, add: plan.add.length, update: plan.update.length,
      unchanged: plan.unchanged, ambiguous: plan.ambiguous.length, skipped: parsed.skipped.length,
    }));

    return NextResponse.json({
      ok: true,
      fileName: file.name,
      parsedRows: parsed.rows.length,
      skipped: parsed.skipped,
      duplicatesInFile: parsed.duplicatesInFile,
      debug: parsed.debug,
      plan,
    });
  });
}

/**
 * STEP 2 — apply a confirmed plan. The client sends back the rows it wants, so
 * the file is never re-uploaded and the admin can take the additions without the
 * price updates. Everything runs in one transaction.
 */
export async function PUT(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json();
    const add = Array.isArray(body?.add) ? body.add : [];
    const update = Array.isArray(body?.update) ? body.update : [];
    if (!add.length && !update.length) return jsonError(400, "Nu ai selectat nimic de importat.");
    if (add.length + update.length > MAX_ROWS) return jsonError(400, "Prea multe rânduri într-o singură operațiune.");

    // Validate every row through the same rules as manual entry before writing.
    const toAdd: { name: string; price: number }[] = [];
    for (const row of add) {
      const parsed = readProductBody({ name: row?.name, price: row?.price });
      if (typeof parsed === "string") return jsonError(400, `„${String(row?.name ?? "")}": ${parsed}`);
      toAdd.push({ name: parsed.name, price: parsed.price });
    }
    const toUpdate: { id: number; price: number }[] = [];
    for (const row of update) {
      const id = Number(row?.id);
      if (!Number.isInteger(id) || id <= 0) return jsonError(400, "Identificator de produs invalid.");
      const existing = db.prepare("SELECT id, name, price, grams FROM products WHERE id = ?").get(id) as Product | undefined;
      if (!existing) return jsonError(404, `Produsul #${id} nu mai există în catalog.`);
      // The preview emits {id, name, from, to}; `price` is accepted as an alias.
      // Never fall back to a default here: a missing value used to be read as an
      // explicit blank and reset the price to 0.
      const raw = row?.to !== undefined ? row.to : row?.price;
      if (raw === undefined || raw === null || raw === "")
        return jsonError(400, `«${existing.name}»: lipsește prețul nou.`);
      const parsed = readProductBody({ price: raw }, existing);
      if (typeof parsed === "string") return jsonError(400, `«${existing.name}»: ${parsed}`);
      toUpdate.push({ id, price: parsed.price });
    }

    const result = db.transaction(() => {
      // grams stays 0: the kitchen export carries no portion weights, and an
      // import must never wipe a weight an admin has already filled in.
      const ins = db.prepare("INSERT INTO products (name, price, grams) VALUES (?,?,0)");
      for (const p of toAdd) ins.run(p.name, p.price);
      const upd = db.prepare("UPDATE products SET price = ? WHERE id = ?");
      for (const p of toUpdate) upd.run(p.price, p.id);
      return { added: toAdd.length, updated: toUpdate.length };
    })();

    const total = (db.prepare("SELECT COUNT(*) c FROM products").get() as { c: number }).c;
    console.log(`[products/import] applied: +${result.added} added, ${result.updated} updated, total ${total}`);
    return NextResponse.json({ ok: true, ...result, total });
  });
}
