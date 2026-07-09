"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Field, Input, Spinner } from "@/components/ui";
import { useToast } from "@/components/providers";

type Row = { category: string; name: string; grams: string; priceMdl: string; warnings: string[] };

function todayISO() { return new Date().toISOString().slice(0, 10); }
const emptyRow = (): Row => ({ category: "", name: "", grams: "", priceMdl: "", warnings: [] });

export default function AdminUploadPage() {
  const toast = useToast();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [date, setDate] = useState(todayISO());
  const [parsing, setParsing] = useState(false);
  const [publishing, setPublishing] = useState(false);

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
    setRows([emptyRow()]);
  }

  async function publish(asDraft: boolean) {
    if (!rows?.length) { toast.push("Adaugă cel puțin un produs.", "error"); return; }
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
        <p className="mt-3 text-xs text-slate-500">
          Preferi să introduci meniul manual, fără fișier?{" "}
          <button onClick={startEmpty} className="font-semibold text-brand-600 underline">Începe cu un tabel gol</button>.
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
                {rows.map((r, i) => (
                  <tr key={i} className={r.warnings.length ? "bg-amber-50/60" : ""}>
                    <td className="px-4 py-2"><Input value={r.category} onChange={(e) => update(i, { category: e.target.value })} placeholder="Categorie" className="!py-1.5" /></td>
                    <td className="px-4 py-2">
                      <Input value={r.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Denumire produs" className="!py-1.5" />
                      {r.warnings.length > 0 && <span className="mt-1 inline-block"><Badge tone="gold">{r.warnings.join(", ")}</Badge></span>}
                    </td>
                    <td className="px-4 py-2 w-24"><Input value={r.grams} inputMode="numeric" onChange={(e) => update(i, { grams: e.target.value })} placeholder="g" className="!py-1.5" /></td>
                    <td className="px-4 py-2 w-24"><Input value={r.priceMdl} inputMode="decimal" onChange={(e) => update(i, { priceMdl: e.target.value })} placeholder="MDL" className="!py-1.5" /></td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => removeRow(i)} className="text-sm font-semibold text-red-600 hover:underline">Elimină</button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">Niciun rând — adaugă primul produs.</td></tr>
                )}
              </tbody>
            </table>
            <div className="border-t border-brand-100 p-3">
              <Button small variant="outline" onClick={addRow}>+ Adaugă un rând</Button>
            </div>
          </Card>

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
    </div>
  );
}
