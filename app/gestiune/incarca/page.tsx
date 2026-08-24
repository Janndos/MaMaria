"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Field, Input, Spinner } from "@/components/ui";
import { useToast } from "@/components/providers";
import { CatalogPicker, CatalogProduct } from "./catalog-picker";
import { CategorySelect } from "./category-select";

type Row = {
  /** Stable identity for React. Keying rows by array index let a row's local
   *  component state (the category picker's "custom" mode, focus) jump to a
   *  different row when one above it was deleted. */
  uid: number;
  category: string; name: string; grams: string; priceMdl: string; warnings: string[];
  /** Added from the price list, which carries no category/gram weight — those two
   *  fields must be completed by hand before the menu can be published. */
  fromCatalog?: boolean;
};

function todayISO() { return new Date().toISOString().slice(0, 10); }

let rowSeq = 0;
const nextUid = () => ++rowSeq;
const emptyRow = (): Row => ({ uid: nextUid(), category: "", name: "", grams: "", priceMdl: "", warnings: [] });

/** A catalogue row still missing something before it can be published. The
 *  category is never in the catalogue; the gramaj is there only once someone
 *  fills it in; and a handful of catalogue entries (dough, sauces) are priced 0,
 *  which is not a valid menu price. */
function needsCompletion(r: Row) {
  if (!r.fromCatalog) return false;
  return !r.category.trim() || !(Number(r.grams) > 0) || !(Number(r.priceMdl) > 0);
}

export default function AdminUploadPage() {
  const toast = useToast();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [date, setDate] = useState(todayISO());
  const [parsing, setParsing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const addedFromCatalog = useRef(0);

  /** Every category already used in the table — offered in each row's dropdown so
   *  a hand-written section only has to be typed once. */
  const usedCategories = useMemo(
    () => Array.from(new Set((rows ?? []).map((r) => r.category.trim()).filter(Boolean))),
    [rows],
  );

  async function parseFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.push("Alegeți un fișier .xlsx sau .csv.", "error"); return; }
    setParsing(true);
    setRows(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: form });
    const data = await res.json();
    setParsing(false);
    if (!res.ok) { setErrors([data.error]); return; }
    setErrors(data.errors ?? []);
    setRows((data.items ?? []).map((it: any) => ({
      uid: nextUid(),
      category: it.category, name: it.name,
      grams: it.grams === null ? "" : String(it.grams),
      priceMdl: it.priceMdl === null ? "" : String(it.priceMdl),
      warnings: it.warnings ?? [],
    })));
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev!.map((r, j) => (j === i ? { ...r, ...patch, warnings: [] } : r)));
  }
  function removeRow(i: number) {
    setRows((prev) => prev!.filter((_, j) => j !== i));
  }
  function addRow() {
    setRows((prev) => {
      const last = prev && prev.length ? prev[prev.length - 1] : null;
      const r = emptyRow();
      if (last) r.category = last.category; // keep the current section for quick entry
      return [...(prev ?? []), r];
    });
  }
  function startEmpty() {
    setErrors([]);
    setRows((prev) => (prev?.length ? prev : [emptyRow()]));
  }

  /** Open the price-list picker, creating the table first if we're starting cold. */
  function openPicker() {
    setErrors([]);
    setRows((prev) => prev ?? []);
    setPickerOpen(true);
  }

  /** Products chosen from the price list arrive with a name, a price and — when
   *  someone has filled it in on the Catalog screen — a portion weight. The
   *  category is never stored in the catalogue, so it comes from whatever section
   *  is selected in the picker (blank if none), and a gramaj of 0 means "not
   *  filled in yet" and starts blank. A name typed into the picker that isn't in
   *  the catalogue arrives with price 0. */
  function addFromCatalog(products: CatalogProduct[], category = "") {
    setRows((prev) => [
      ...(prev ?? []),
      ...products.map((p) => ({
        uid: nextUid(),
        category, name: p.name,
        grams: p.grams > 0 ? String(p.grams) : "",
        priceMdl: p.price > 0 ? String(p.price) : "", warnings: [], fromCatalog: true,
      })),
    ]);
    addedFromCatalog.current += products.length;
  }

  /** One summary toast when the picker closes, instead of one per click. */
  function closePicker() {
    setPickerOpen(false);
    const n = addedFromCatalog.current;
    addedFromCatalog.current = 0;
    if (n > 0) {
      toast.push(`${n} produs${n === 1 ? "" : "e"} adăugat${n === 1 ? "" : "e"} în tabel.`);
    }
  }

  async function publish(asDraft: boolean) {
    if (!rows?.length) { toast.push("Adaugă cel puțin un produs.", "error"); return; }
    if (rows.some(needsCompletion)) {
      toast.push("Completează câmpurile marcate cu galben pentru produsele din catalog.", "error");
      return;
    }
    for (const r of rows) {
      if (!r.name.trim() || !(Number(r.grams) > 0) || !(Number(r.priceMdl) > 0)) {
        toast.push("Completați denumirea, gramajul și prețul pentru fiecare rând.", "error");
        return;
      }
    }
    setPublishing(true);
    const res = await fetch("/api/admin/menus", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date, title: "Meniul zilei", publish: !asDraft,
        items: rows.map((r) => ({ category: r.category.trim() || "Diverse", name: r.name.trim(), grams: Number(r.grams), priceMdl: Number(r.priceMdl) })),
      }),
    });
    const data = await res.json();
    setPublishing(false);
    if (!res.ok) { toast.push(data.error || "Eroare la publicare.", "error"); return; }
    toast.push(asDraft ? "Meniul a fost salvat ca ciornă." : "Meniul a fost publicat!");
    router.push("/gestiune/meniu");
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="font-display text-lg font-bold text-brand-800">Încarcă meniul zilei</h2>
        <p className="mt-1 text-sm text-slate-600">
          Formatul standard este fișierul Excel folosit în bucătărie: coloanele{" "}
          <em>№, Denumire, Masa / gr, Pret portie MDL</em>, cu rândurile de categorie
          (<em>Felul întâi, Garnitură, Bucate din carne, Salate, Altele</em>) scrise pe coloana Denumire.
          După analiză poți corecta orice rând, adăuga produse noi sau șterge rânduri înainte de publicare.
        </p>
        <div className="mt-3">
          <a href="/api/admin/template"
            className="inline-flex items-center gap-2 rounded-full border border-brand-200 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3m0 12 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
            Descarcă modelul Excel
          </a>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Fișier Excel / CSV">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
              className="block w-full max-w-xs text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-brand-600" />
          </Field>
          <Field label="Data meniului">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </Field>
          <Button onClick={parseFile} disabled={parsing}>{parsing ? "Se analizează..." : "Analizează fișierul"}</Button>
        </div>
      </Card>

      {/* Manual builder — the alternative to the Excel file. */}
      <Card className="p-5">
        <h2 className="font-display text-lg font-bold text-brand-800">Creează-l singur!</h2>
        <p className="mt-1 text-sm text-slate-600">
          Nu ai fișier Excel? Construiește meniul direct aici. Poți scrie fiecare produs de la zero
          (categorie, denumire, gramaj, preț) sau îl poți lua din{" "}
          <span className="font-semibold">catalogul de prețuri</span> al bucătăriei.
        </p>
        <p className="mt-2 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
          Catalogul reține <span className="font-semibold">denumirea, prețul și gramajul</span> (dacă a
          fost completat în <span className="font-semibold">Catalog</span>). Categoria nu se stochează
          acolo, așa că o alegi din listă la fiecare rând — rândurile neterminate rămân marcate cu
          galben și nu pot fi publicate.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={openPicker}>🔎 Alege din catalogul de prețuri</Button>
          <Button variant="outline" onClick={startEmpty}>✎ Începe cu un tabel gol</Button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          După salvare poți genera imaginea și PDF-ul A4 al meniului (pentru printare sau Telegram)
          din <Link href="/gestiune/noutati" className="font-semibold text-brand-600 underline">Noutăți</Link>
          {" "}→ „Generează meniul" → „Din meniul salvat".
        </p>
      </Card>

      {parsing && <Spinner label="Se citește fișierul..." />}

      {errors.length > 0 && (
        <div className="rounded-card bg-amber-50 px-5 py-4">
          <p className="mb-1 text-sm font-bold text-amber-900">Verifică aceste rânduri:</p>
          {errors.map((e, i) => <p key={i} className="text-sm font-medium text-amber-800">⚠ {e}</p>)}
        </div>
      )}

      {rows && (
        <>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-brand-50 text-left text-xs font-bold uppercase tracking-wide text-brand-700">
                  <th className="px-4 py-2.5">Categorie</th>
                  <th className="px-4 py-2.5">Denumire</th>
                  <th className="px-4 py-2.5">Gramaj</th>
                  <th className="px-4 py-2.5">Preț MDL</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {rows.map((r, i) => {
                  const todo = needsCompletion(r);
                  return (
                  <tr key={r.uid} className={r.warnings.length || todo ? "bg-amber-50/60" : ""}>
                    <td className="px-4 py-2 align-top w-52">
                      <CategorySelect value={r.category} used={usedCategories}
                        invalid={todo && !r.category.trim()}
                        onChange={(v) => update(i, { category: v })} />
                    </td>
                    <td className="px-4 py-2">
                      <Input value={r.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Denumire produs" className="!py-1.5" />
                      {r.warnings.length > 0 && <span className="mt-1 inline-block"><Badge tone="gold">{r.warnings.join(", ")}</Badge></span>}
                      {todo && (
                        <span className="mt-1 inline-block">
                          <Badge tone="gold">din catalog — completează câmpurile marcate</Badge>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 w-24">
                      <Input value={r.grams} inputMode="numeric" onChange={(e) => update(i, { grams: e.target.value })}
                        placeholder="g" className={`!py-1.5 ${todo && !(Number(r.grams) > 0) ? "!border-amber-400" : ""}`} />
                    </td>
                    <td className="px-4 py-2 w-24">
                      <Input value={r.priceMdl} inputMode="decimal" onChange={(e) => update(i, { priceMdl: e.target.value })}
                        placeholder="MDL" className={`!py-1.5 ${todo && !(Number(r.priceMdl) > 0) ? "!border-amber-400" : ""}`} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => removeRow(i)} className="text-sm font-semibold text-red-600 hover:underline">Elimină</button>
                    </td>
                  </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">Niciun rând — adaugă primul produs sau alege din catalog.</td></tr>
                )}
              </tbody>
            </table>
            <div className="flex flex-wrap gap-2 border-t border-brand-100 p-3">
              <Button small variant="outline" onClick={addRow}>+ Adaugă un rând</Button>
              <Button small variant="outline" onClick={openPicker}>🔎 Alege din catalog</Button>
            </div>
          </Card>

          {rows.some(needsCompletion) && (
            <div className="rounded-card bg-amber-50 px-5 py-4">
              <p className="text-sm font-bold text-amber-900">
                {rows.filter(needsCompletion).length} produs(e) din catalog au câmpuri necompletate
              </p>
              <p className="mt-0.5 text-sm text-amber-800">
                Alege categoria și completează gramajul/prețul în rândurile marcate cu galben,
                apoi publică meniul.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => publish(false)} disabled={publishing}>
              {publishing ? "Se publică..." : `Publică meniul pentru ${date}`}
            </Button>
            <Button variant="outline" onClick={() => publish(true)} disabled={publishing}>Salvează ca ciornă</Button>
          </div>
          <p className="text-xs text-slate-500">
            Dacă există deja un meniu pentru această dată, produsele lui vor fi înlocuite cu cele din tabel.
            Poți edita ulterior orice produs din <span className="font-semibold">Meniul zilei</span>.
          </p>
        </>
      )}

      <CatalogPicker open={pickerOpen} onClose={closePicker} onAdd={addFromCatalog}
        usedCategories={usedCategories} />
    </div>
  );
}
