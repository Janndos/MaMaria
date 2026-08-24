"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, Modal, Spinner } from "@/components/ui";
import { useToast } from "@/components/providers";
import { foldNames, rankedFilter } from "@/lib/search";
import { gramsError, priceError } from "@/lib/products";

type Product = { id: number; name: string; price: number; grams: number };
/** A row being edited: the saved values plus whatever is currently in the inputs. */
type Draft = { name: string; price: string; grams: string };

const PAGE_SIZE = 50;

/** Strip diacritics and case so "Mămăligă" is found by typing "mamaliga". */
function fold(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function toDraft(p: Product): Draft {
  // grams 0 means "not filled in yet" — show it as an empty field, not a literal 0.
  return { name: p.name, price: String(p.price), grams: p.grams > 0 ? String(p.grams) : "" };
}
function isDirty(p: Product, d: Draft): boolean {
  const saved = toDraft(p);
  return d.name !== saved.name || d.price !== saved.price || d.grams !== saved.grams;
}

/** First validation problem in a draft row, or null when it is publishable. */
function draftError(d: Draft): string | null {
  if (!d.name.trim()) return "Denumirea este obligatorie.";
  return priceError(d.price) ?? gramsError(d.grams);
}

export default function AdminCatalogPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [adding, setAdding] = useState<Draft>({ name: "", price: "", grams: "" });
  const [busyAdd, setBusyAdd] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/products?limit=5000");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "load failed");
      setProducts(data.products ?? []);
      setLoadFailed(false);
    } catch {
      // Never leave the screen on a spinner forever.
      setProducts([]);
      setLoadFailed(true);
    }
    setDrafts({});
  }, []);
  useEffect(() => { load(); }, [load]);

  // Filter locally — the whole catalogue is already in memory. Same forgiving
  // matcher as the menu-builder picker, so a typo finds the product either way.
  const indexed = useMemo(() => foldNames(products ?? []), [products]);
  const filtered = useMemo(() => rankedFilter(indexed, q), [indexed, q]);

  useEffect(() => { setPage(0); }, [q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Deleting the last rows of the last page would otherwise strand the admin on
  // an empty page with no way back.
  const safePage = Math.min(page, pageCount - 1);
  useEffect(() => { if (page !== safePage) setPage(safePage); }, [page, safePage]);
  const shown = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const missingGrams = (products ?? []).filter((p) => !p.grams).length;

  function draftOf(p: Product): Draft {
    return drafts[p.id] ?? toDraft(p);
  }
  function setDraft(p: Product, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [p.id]: { ...draftOf(p), ...patch } }));
  }
  function revert(p: Product) {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[p.id];
      return next;
    });
  }

  async function save(p: Product) {
    const d = draftOf(p);
    const err = draftError(d);
    if (err) { toast.push(err, "error"); return; }
    setSaving(p.id);
    try {
      // Raw strings on the wire: Number("12,5") is NaN, JSON turns NaN into null,
      // and the server then read that as "field not sent" — silently keeping the
      // old price while reporting success. The server parses and validates.
      const res = await fetch(`/api/admin/products/${p.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: d.name.trim(), price: d.price, grams: d.grams }),
      });
      const data = await res.json();
      if (!res.ok) { toast.push(data.error || "Eroare la salvare.", "error"); return; }
      setProducts((prev) => (prev ?? []).map((x) => (x.id === p.id ? data.product : x)));
      revert(p);
      toast.push(`„${data.product.name}" a fost actualizat.`);
    } catch {
      toast.push("Eroare de rețea.", "error");
    } finally {
      setSaving(null);
    }
  }

  async function add() {
    const err = draftError(adding);
    if (err) { toast.push(err, "error"); return; }
    setBusyAdd(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: adding.name.trim(), price: adding.price, grams: adding.grams }),
      });
      const data = await res.json();
      if (!res.ok) { toast.push(data.error || "Eroare la adăugare.", "error"); return; }
      // Keep the in-memory list name-sorted like the server returns it, so the
      // new product appears in its alphabetical place and not at the very end.
      setProducts((prev) => [...(prev ?? []), data.product]
        .sort((a, b) => a.name.localeCompare(b.name, "ro")));
      setAdding({ name: "", price: "", grams: "" });
      setQ(data.product.name); // jump straight to the product just created
      toast.push(`„${data.product.name}" a fost adăugat în catalog.`);
    } catch {
      toast.push("Eroare de rețea.", "error");
    } finally {
      setBusyAdd(false);
    }
  }

  async function remove(p: Product) {
    setConfirmDelete(null);
    const res = await fetch(`/api/admin/products/${p.id}`, { method: "DELETE" });
    if (!res.ok) { toast.push((await res.json()).error || "Eroare la ștergere.", "error"); return; }
    setProducts((prev) => (prev ?? []).filter((x) => x.id !== p.id));
    toast.push(`„${p.name}" a fost șters din catalog.`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-brand-800">Catalog de prețuri</h1>
        <p className="mt-1 text-sm text-slate-600">
          Lista completă de produse din care se construiesc meniurile zilei. Poți schimba denumirea,
          prețul și gramajul, poți adăuga produse noi sau șterge produse învechite.
          Gramajul este <span className="font-semibold">0 (necompletat)</span> pentru produsele importate —
          completează-l pe rând, iar apoi se preia automat în „Încarcă meniul".
        </p>
      </div>

      {/* Add a new product */}
      <Card className="p-5">
        <h2 className="font-display font-bold text-brand-800">Adaugă un produs</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block min-w-[16rem] flex-1">
            <span className="mb-1.5 block text-sm font-semibold text-brand-800">Denumire</span>
            <Input value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })}
              placeholder="Ex.: Ciorbă de pui cu tăiței" />
          </label>
          <label className="block w-32">
            <span className="mb-1.5 block text-sm font-semibold text-brand-800">Gramaj (g)</span>
            <Input value={adding.grams} inputMode="numeric" onChange={(e) => setAdding({ ...adding, grams: e.target.value })}
              placeholder="0" />
          </label>
          <label className="block w-32">
            <span className="mb-1.5 block text-sm font-semibold text-brand-800">Preț (MDL)</span>
            <Input value={adding.price} inputMode="decimal" onChange={(e) => setAdding({ ...adding, price: e.target.value })}
              placeholder="0" />
          </label>
          <Button onClick={add} disabled={busyAdd}>{busyAdd ? "Se adaugă…" : "+ Adaugă"}</Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Gramajul și prețul sunt opționale — rămân 0 dacă nu le completezi.
        </p>
      </Card>

      {/* Search + counters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm"
          placeholder={products ? `Caută printre ${products.length} produse…` : "Se încarcă…"} />
        {products && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <Badge tone="brand">{filtered.length} afișate</Badge>
            {missingGrams > 0 && <Badge tone="gold">{missingGrams} fără gramaj (în total)</Badge>}
          </div>
        )}
      </div>

      {loadFailed && (
        <div className="rounded-card bg-red-50 px-5 py-4">
          <p className="text-sm font-bold text-red-800">Catalogul nu a putut fi încărcat.</p>
          <p className="mt-0.5 text-sm text-red-700">Verifică conexiunea și încearcă din nou.</p>
          <div className="mt-3"><Button small variant="outline" onClick={load}>Reîncarcă</Button></div>
        </div>
      )}

      {products === null ? (
        <Spinner label="Se încarcă catalogul..." />
      ) : filtered.length === 0 ? (
        <EmptyState title={q ? `Niciun produs pentru „${q}"` : "Catalogul este gol"}
          hint={q ? "Verifică scrierea sau adaugă produsul mai sus." : "Adaugă primul produs folosind formularul de mai sus."} />
      ) : (
        <>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-brand-50 text-left text-xs font-bold uppercase tracking-wide text-brand-700">
                  <th className="px-4 py-2.5">Denumire</th>
                  <th className="px-4 py-2.5 w-32">Gramaj (g)</th>
                  <th className="px-4 py-2.5 w-32">Preț (MDL)</th>
                  <th className="px-4 py-2.5 w-56"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {shown.map((p) => {
                  const d = draftOf(p);
                  const dirty = isDirty(p, d);
                  const gErr = dirty ? gramsError(d.grams) : null;
                  const pErr = dirty ? priceError(d.price) : null;
                  const nErr = dirty && !d.name.trim() ? "Denumirea este obligatorie." : null;
                  const rowErr = nErr ?? pErr ?? gErr;
                  return (
                    <tr key={p.id} className={rowErr ? "bg-red-50/60" : dirty ? "bg-amber-50/60" : ""}>
                      <td className="px-4 py-2 align-top">
                        <Input value={d.name} onChange={(e) => setDraft(p, { name: e.target.value })}
                          className={`!py-1.5 ${nErr ? "!border-red-400" : ""}`} />
                        {rowErr && <p className="mt-1 text-xs font-medium text-red-600">{rowErr}</p>}
                      </td>
                      <td className="px-4 py-2 align-top">
                        <Input value={d.grams} inputMode="numeric" placeholder="0"
                          onChange={(e) => setDraft(p, { grams: e.target.value })}
                          className={`!py-1.5 ${gErr ? "!border-red-400" : ""}`} />
                      </td>
                      <td className="px-4 py-2 align-top">
                        <Input value={d.price} inputMode="decimal" placeholder="0"
                          onChange={(e) => setDraft(p, { price: e.target.value })}
                          className={`!py-1.5 ${pErr ? "!border-red-400" : ""}`} />
                      </td>
                      <td className="px-4 py-2 align-top">
                        <div className="flex flex-wrap justify-end gap-2">
                          {dirty && (
                            <>
                              <Button small onClick={() => save(p)} disabled={saving === p.id || !!rowErr}>
                                {saving === p.id ? "Se salvează…" : "Salvează"}
                              </Button>
                              <Button small variant="ghost" onClick={() => revert(p)}>Renunță</Button>
                            </>
                          )}
                          {!dirty && (
                            <button onClick={() => setConfirmDelete(p)}
                              className="text-sm font-semibold text-red-600 hover:underline">
                              Șterge
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {pageCount > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                Pagina {safePage + 1} din {pageCount} · produsele {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)}
              </p>
              <div className="flex gap-2">
                <Button small variant="outline" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}>
                  ← Înapoi
                </Button>
                <Button small variant="outline" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1}>
                  Înainte →
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={!!confirmDelete} title="Ștergi produsul din catalog?" onClose={() => setConfirmDelete(null)}>
        <p className="text-sm text-slate-600">
          „{confirmDelete?.name}" va dispărea din catalogul de prețuri. Meniurile deja salvate nu sunt
          afectate — ele păstrează propria copie a denumirii, gramajului și prețului.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Renunță</Button>
          <Button variant="danger" onClick={() => confirmDelete && remove(confirmDelete)}>Șterge</Button>
        </div>
      </Modal>
    </div>
  );
}
