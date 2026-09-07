"use client";
import { useRef, useState } from "react";
import { Badge, Button, Card, Spinner } from "@/components/ui";
import { useToast } from "@/components/providers";

type Row = { name: string; price: number };
type Plan = {
  add: Row[];
  update: { id: number; name: string; from: number; to: number }[];
  unchanged: number;
  ambiguous: { name: string; filePrices: number[]; dbPrices: number[] }[];
  onlyInCatalog: number;
};
type Preview = {
  fileName: string;
  parsedRows: number;
  skipped: { row: number; name: string; reason: string }[];
  duplicatesInFile: number;
  debug: { sheetName: string | null; headerRow: number | null; columns: { name: number; price: number }; dataRows: number };
  plan: Plan;
};

const lei = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2)} lei`;

/**
 * Import the kitchen software's product export ("Lista bucate.xlsx") into the
 * price list.
 *
 * Two steps on purpose: the upload only ever previews what would change, and
 * nothing is written until the admin confirms. Re-uploading the same file adds
 * nothing, so the usual workflow — export again once a few dishes were added —
 * imports exactly those dishes.
 */
export function CatalogImportCard({ onImported }: { onImported: () => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"" | "preview" | "apply">("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [withUpdates, setWithUpdates] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  function pick(f: File | null) {
    setFile(f); setPreview(null); setError(""); setShowDetails(false);
  }

  async function analyse() {
    if (!file) { toast.push("Alegeți un fișier .xlsx.", "error"); return; }
    setBusy("preview"); setError(""); setPreview(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/products/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Fișierul nu a putut fi analizat."); return; }
      setPreview(data);
      setWithUpdates(true);
      if (!data.plan.add.length && !data.plan.update.length) {
        toast.push("Catalogul este deja la zi — nimic de importat.");
      }
    } catch {
      setError("Eroare de rețea.");
    } finally { setBusy(""); }
  }

  async function apply() {
    if (!preview) return;
    const { add, update } = preview.plan;
    setBusy("apply");
    try {
      const res = await fetch("/api/admin/products/import", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ add, update: withUpdates ? update : [] }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Importul a eșuat."); toast.push(data.error || "Importul a eșuat.", "error"); return; }
      toast.push(`Import finalizat: ${data.added} produse adăugate, ${data.updated} prețuri actualizate.`);
      setPreview(null); setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      onImported();
    } catch {
      toast.push("Eroare de rețea.", "error");
    } finally { setBusy(""); }
  }

  const p = preview?.plan;
  const nothingToDo = !!p && p.add.length === 0 && p.update.length === 0;

  return (
    <Card className="p-5">
      <h2 className="font-display font-bold text-brand-800">Importă din Excel</h2>
      <p className="mt-1 text-sm text-slate-600">
        Încarcă exportul din programul bucătăriei (<em>Lista bucate.xlsx</em> — coloanele
        <em> Название</em> și <em> Цена, lei</em>). Se preiau doar denumirea și prețul.
        Produsele care există deja sunt ignorate, așa că poți încărca de fiecare dată fișierul
        întreg — se adaugă doar rândurile noi. <span className="font-semibold">Nimic nu se șterge.</span>
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        <Button small variant="outline" onClick={() => fileRef.current?.click()} disabled={busy !== ""}>
          {file ? "Schimbă fișierul" : "Alege fișier .xlsx"}
        </Button>
        {file && (
          <span className="text-sm text-slate-600">
            📄 {file.name} <span className="text-slate-400">({Math.ceil(file.size / 1024)} KB)</span>
          </span>
        )}
        <Button onClick={analyse} disabled={!file || busy !== ""}>
          {busy === "preview" ? "Se analizează…" : "Analizează fișierul"}
        </Button>
      </div>

      {busy === "preview" && <div className="mt-4"><Spinner label="Se citește fișierul..." /></div>}
      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{error}</p>}

      {preview && p && (
        <div className="mt-4 space-y-3 rounded-xl border border-brand-100 bg-brand-50/40 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="green">{p.add.length} produse noi</Badge>
            <Badge tone="gold">{p.update.length} prețuri modificate</Badge>
            <Badge tone="gray">{p.unchanged} neschimbate</Badge>
            {p.ambiguous.length > 0 && <Badge tone="red">{p.ambiguous.length} neclare</Badge>}
            {preview.skipped.length > 0 && <Badge tone="red">{preview.skipped.length} rânduri ignorate</Badge>}
          </div>
          <p className="text-xs text-slate-500">
            Fișier: {preview.fileName} · foaia «{preview.debug.sheetName}» · cap de tabel pe rândul{" "}
            {preview.debug.headerRow} · {preview.parsedRows} rânduri citite
            {preview.duplicatesInFile > 0 && ` · ${preview.duplicatesInFile} duplicate în fișier`}
            {p.onlyInCatalog > 0 && ` · ${p.onlyInCatalog} produse din catalog nu apar în fișier (se păstrează)`}
          </p>

          {nothingToDo ? (
            <p className="rounded-lg bg-white px-4 py-3 text-sm font-medium text-brand-800">
              Catalogul este deja la zi — fișierul nu conține produse noi.
            </p>
          ) : (
            <>
              {p.update.length > 0 && (
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={withUpdates} onChange={(e) => setWithUpdates(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-brand-300 text-brand-600 focus:ring-brand-200" />
                  <span>
                    Actualizează și cele <span className="font-semibold">{p.update.length}</span> prețuri modificate
                    <span className="block text-xs text-slate-500">
                      Debifat, se adaugă doar produsele noi și prețurile actuale rămân neatinse.
                    </span>
                  </span>
                </label>
              )}

              <button onClick={() => setShowDetails((v) => !v)} className="text-sm font-semibold text-brand-600 underline">
                {showDetails ? "Ascunde detaliile" : "Vezi ce se va schimba"}
              </button>

              {showDetails && (
                <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg bg-white p-3 text-sm">
                  {p.add.length > 0 && (
                    <div>
                      <p className="font-semibold text-emerald-700">Se adaugă ({p.add.length})</p>
                      <ul className="mt-1 space-y-0.5">
                        {p.add.map((r, i) => (
                          <li key={i} className="flex justify-between gap-3">
                            <span className="min-w-0 truncate">{r.name}</span>
                            <span className="shrink-0 tabular-nums text-slate-600">{lei(r.price)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {p.update.length > 0 && (
                    <div>
                      <p className="font-semibold text-amber-700">Preț modificat ({p.update.length})</p>
                      <ul className="mt-1 space-y-0.5">
                        {p.update.map((r) => (
                          <li key={r.id} className="flex justify-between gap-3">
                            <span className="min-w-0 truncate">{r.name}</span>
                            <span className="shrink-0 tabular-nums text-slate-600">
                              <s className="text-slate-400">{lei(r.from)}</s> → {lei(r.to)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {p.ambiguous.length > 0 && (
                    <div>
                      <p className="font-semibold text-red-700">Neclare — se ignoră ({p.ambiguous.length})</p>
                      <p className="text-xs text-slate-500">
                        Aceeași denumire apare de mai multe ori cu prețuri diferite, așa că nu se poate
                        ghici ce rând se actualizează. Modifică-le manual în tabelul de mai jos.
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {p.ambiguous.map((a, i) => (
                          <li key={i} className="flex justify-between gap-3">
                            <span className="min-w-0 truncate">{a.name}</span>
                            <span className="shrink-0 tabular-nums text-slate-500">
                              fișier: {a.filePrices.map(lei).join(", ")} · catalog: {a.dbPrices.map(lei).join(", ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {preview.skipped.length > 0 && (
                    <div>
                      <p className="font-semibold text-red-700">Rânduri ignorate ({preview.skipped.length})</p>
                      <ul className="mt-1 space-y-0.5">
                        {preview.skipped.map((sk, i) => (
                          <li key={i} className="text-slate-600">
                            rândul {sk.row}: {sk.name || "(fără denumire)"} — {sk.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <Button onClick={apply} disabled={busy !== ""}>
                {busy === "apply"
                  ? "Se importă…"
                  : `Importă ${p.add.length} produse${withUpdates && p.update.length ? ` + ${p.update.length} prețuri` : ""}`}
              </Button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
