"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, fmtMdl, Input, Modal, Spinner } from "@/components/ui";
import { fold, rank } from "@/lib/search";
import { CategorySelect } from "./category-select";

export type CatalogProduct = { id: number; name: string; price: number; grams: number };

/**
 * Search-and-pick dialog over the product price list (`products`).
 *
 * The whole catalogue is loaded once and filtered in the browser, so the admin
 * always sees the full list and typing filters it instantly. Clicking a name adds
 * it to the menu table straight away and leaves the dialog open for the next pick.
 *
 * The catalogue stores a name, a price and (once someone fills it in on the
 * Catalog screen) a portion weight. It never stores a category, so the section is
 * chosen here and applied to everything added in this session; the gramaj is
 * pre-filled when the catalogue knows it and left blank when it is still 0.
 */
export function CatalogPicker({
  open, onClose, onAdd, usedCategories = [],
}: {
  open: boolean;
  onClose: () => void;
  /** Called as soon as a product is clicked (and for a typed-in custom name),
   *  together with the section selected in this dialog ("" when none). */
  onAdd: (products: CatalogProduct[], category: string) => void;
  /** Categories already used in the menu table, offered in the dropdown. */
  usedCategories?: string[];
}) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState<CatalogProduct[] | null>(null);
  const [failed, setFailed] = useState(false);
  /** How many times each product was added during this session (for the ✓ badge). */
  const [addedCounts, setAddedCounts] = useState<Record<number, number>>({});
  /** Section applied to everything added from this dialog. Optional — left blank
   *  the rows land uncategorised and are flagged in the table as before. */
  const [category, setCategory] = useState("");
  /** Ids for names typed by hand; negative and strictly decreasing so two custom
   *  products added in the same millisecond can never collide. */
  const nextCustomId = useRef(-1);
  const loaded = useRef(false);

  // Fetch the entire catalogue once, the first time the dialog is opened.
  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/products?limit=5000");
        const data = await res.json();
        setAll(data.products ?? []);
      } catch {
        setFailed(true);
        setAll([]);
      }
    })();
  }, [open]);

  // Reset query, counters AND the chosen section each time the dialog reopens.
  // Carrying a stale section over would silently file the next batch under the
  // previous one — and a row that HAS a category is not flagged for review.
  useEffect(() => {
    if (open) { setQ(""); setAddedCounts({}); setCategory(""); }
  }, [open]);

  // Pre-fold every name once so filtering stays instant across 600+ rows.
  const folded = useMemo(
    () => (all ?? []).map((p) => ({ p, f: fold(p.name) })),
    [all],
  );

  const results = useMemo(() => {
    const query = fold(q);
    if (!query) return (all ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, "ro"));
    const tokens = query.split(/\s+/).filter(Boolean);
    const squashed = query.replace(/\s+/g, "");
    const scored: { p: CatalogProduct; r: number }[] = [];
    for (const { p, f } of folded) {
      const r = rank(f, query, tokens, squashed);
      if (r >= 0) scored.push({ p, r });
    }
    scored.sort((a, b) => a.r - b.r || a.p.name.localeCompare(b.p.name, "ro"));
    return scored.map((s) => s.p);
  }, [q, folded, all]);

  function add(p: CatalogProduct) {
    onAdd([p], category);
    setAddedCounts((prev) => ({ ...prev, [p.id]: (prev[p.id] ?? 0) + 1 }));
  }

  /** Product not in the price list — add the typed name as a blank-price row. */
  function addTyped() {
    const name = q.trim();
    if (!name) return;
    onAdd([{ id: nextCustomId.current--, name, price: 0, grams: 0 }], category);
    setQ("");
  }

  const totalAdded = Object.values(addedCounts).reduce((s, n) => s + n, 0);

  return (
    <Modal wide open={open} title="Alege din catalogul de prețuri" onClose={onClose}>
      <p className="text-sm text-slate-600">
        Apasă pe denumire ca s-o adaugi în tabel — poți adăuga oricâte, fereastra rămâne deschisă.
      </p>

      {/* Choosing the section here saves setting it on every row afterwards. */}
      <div className="mt-3 rounded-xl bg-brand-50 p-3">
        <span className="mb-1.5 block text-sm font-semibold text-brand-800">
          Adaugă în categoria <span className="font-normal text-slate-500">(opțional)</span>
        </span>
        <CategorySelect value={category} onChange={setCategory} used={usedCategories} />
        <p className="mt-1.5 text-xs text-slate-500">
          Se aplică produselor adăugate de acum înainte. O poți schimba oricând sau lăsa necompletată
          și o alegi apoi în tabel.
        </p>
      </div>

      <Input value={q} onChange={(e) => setQ(e.target.value)} className="mt-3"
        placeholder={all ? `Scrie primele litere… (${all.length} produse)` : "Se încarcă…"} />

      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>
          {all === null ? "…" : q
            ? `${results.length} din ${all.length} produse`
            : `Toate cele ${all.length} produse`}
        </span>
        {totalAdded > 0 && (
          <span className="font-semibold text-brand-700">{totalAdded} adăugate în tabel</span>
        )}
      </div>

      <div className="mt-1.5 max-h-[22rem] overflow-y-auto rounded-xl border border-brand-100">
        {all === null ? (
          <div className="p-4"><Spinner label="Se încarcă catalogul..." /></div>
        ) : failed ? (
          <p className="px-4 py-6 text-center text-sm text-red-600">
            Catalogul nu a putut fi încărcat. Închide și încearcă din nou.
          </p>
        ) : all.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-amber-800">
            Catalogul de prețuri este gol pe acest server.
            <br />
            <span className="text-slate-500">
              Se completează automat la repornirea aplicației; dacă persistă, rulează
              <span className="font-mono"> npm run seed:products</span>.
            </span>
          </p>
        ) : results.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-slate-500">Niciun produs care să semene cu „{q}".</p>
            <div className="mt-3">
              <Button small variant="outline" onClick={addTyped}>
                Adaugă „{q.trim()}" ca produs nou
              </Button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Se adaugă un rând gol în tabel cu această denumire — completezi tu prețul.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-brand-50">
            {results.map((p) => {
              const count = addedCounts[p.id] ?? 0;
              return (
                <li key={p.id}>
                  <button onClick={() => add(p)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-brand-50 active:bg-brand-100">
                    <span className="min-w-0 flex-1 truncate text-ink">{p.name}</span>
                    {count > 0 && (
                      <span className="shrink-0 rounded-full bg-brand-500 px-2 py-0.5 text-xs font-bold text-white">
                        ✓ {count}
                      </span>
                    )}
                    {p.grams > 0 && (
                      <span className="shrink-0 text-xs tabular-nums text-slate-400">{p.grams} g</span>
                    )}
                    <span className="shrink-0 font-semibold tabular-nums text-brand-700">{fmtMdl(p.price)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={onClose}>Gata</Button>
      </div>
    </Modal>
  );
}
