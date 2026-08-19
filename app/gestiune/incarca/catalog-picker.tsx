"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, fmtMdl, Input, Modal, Spinner } from "@/components/ui";

export type CatalogProduct = { id: number; name: string; price: number };

/** Strip diacritics and case so "Mămăligă" is found by typing "mamaliga". */
function fold(s: string): string {
  // NFD splits a letter from its accent, and the range below drops the accents.
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** True when every character of `q` appears in `s` in order — forgiving enough to
 *  survive a dropped letter or two ("ciocata" still finds "ciocolata"). */
function isSubsequence(q: string, s: string): boolean {
  let i = 0;
  for (let j = 0; j < s.length && i < q.length; j++) if (s[j] === q[i]) i++;
  return i === q.length;
}

/**
 * Rank a product against the query. Lower is better, -1 means no match at all:
 *   0 name starts with what was typed
 *   1 the typed text appears somewhere in the name
 *   2 every typed word appears, in any order ("chec ciocolata")
 *   3 the letters appear in order, allowing typos ("chec de ciocata")
 */
function rank(folded: string, q: string, tokens: string[], squashedQ: string): number {
  if (!q) return 0;
  if (folded.startsWith(q)) return 0;
  if (folded.includes(q)) return 1;
  if (tokens.length > 1 && tokens.every((t) => folded.includes(t))) return 2;
  if (squashedQ.length >= 3 && isSubsequence(squashedQ, folded.replace(/\s+/g, ""))) return 3;
  return -1;
}

/**
 * Search-and-pick dialog over the product price list (`products`).
 *
 * The whole catalogue is loaded once and filtered in the browser, so the admin
 * always sees the full list and typing filters it instantly. Clicking a name adds
 * it to the menu table straight away and leaves the dialog open for the next pick.
 *
 * The catalogue stores only a name and a price — it has no category and no gram
 * weight — so every product added from here lands in the table with those two
 * fields deliberately blank for the admin to complete before publishing.
 */
export function CatalogPicker({
  open, onClose, onAdd,
}: {
  open: boolean;
  onClose: () => void;
  /** Called as soon as a product is clicked (and for a typed-in custom name). */
  onAdd: (products: CatalogProduct[]) => void;
}) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState<CatalogProduct[] | null>(null);
  const [failed, setFailed] = useState(false);
  /** How many times each product was added during this session (for the ✓ badge). */
  const [addedCounts, setAddedCounts] = useState<Record<number, number>>({});
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

  // Reset the query and the per-session counters each time it reopens.
  useEffect(() => {
    if (open) { setQ(""); setAddedCounts({}); }
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
    onAdd([p]);
    setAddedCounts((prev) => ({ ...prev, [p.id]: (prev[p.id] ?? 0) + 1 }));
  }

  /** Product not in the price list — add the typed name as a blank-price row. */
  function addTyped() {
    const name = q.trim();
    if (!name) return;
    onAdd([{ id: -Date.now(), name, price: 0 }]);
    setQ("");
  }

  const totalAdded = Object.values(addedCounts).reduce((s, n) => s + n, 0);

  return (
    <Modal wide open={open} title="Alege din catalogul de prețuri" onClose={onClose}>
      <p className="text-sm text-slate-600">
        Apasă pe denumire ca s-o adaugi în tabel — poți adăuga oricâte, fereastra rămâne deschisă.
        Catalogul reține doar <span className="font-semibold">denumirea și prețul</span>; categoria și
        gramajul le completezi tu după aceea.
      </p>

      <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} className="mt-3"
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
