"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, fmtMdl, Input, Modal, Spinner } from "@/components/ui";

export type CatalogProduct = { id: number; name: string; price: number };

/**
 * Search-and-pick dialog over the product price list (`products`).
 *
 * The catalogue stores only a name and a price — it has no category and no gram
 * weight — so every product added from here lands in the menu table with those
 * two fields deliberately blank for the admin to complete before publishing.
 */
export function CatalogPicker({
  open, onClose, onAdd,
}: {
  open: boolean;
  onClose: () => void;
  /** Called with every product chosen in this session, in the order picked. */
  onAdd: (products: CatalogProduct[]) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CatalogProduct[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [picked, setPicked] = useState<CatalogProduct[]>([]);
  const reqSeq = useRef(0);

  const search = useCallback(async (term: string) => {
    const seq = ++reqSeq.current;
    try {
      const res = await fetch(`/api/admin/products?q=${encodeURIComponent(term)}&limit=60`);
      const data = await res.json();
      if (seq !== reqSeq.current) return; // a newer keystroke already won
      setResults(data.products ?? []);
      setTotal(data.total ?? null);
    } catch {
      if (seq === reqSeq.current) setResults([]);
    }
  }, []);

  // Reset and load the head of the catalogue each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setQ("");
    setPicked([]);
    setResults(null);
    search("");
  }, [open, search]);

  // Debounce typing so a fast typist doesn't fire a request per character.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => search(q), 180);
    return () => clearTimeout(t);
  }, [q, open, search]);

  function confirm() {
    if (picked.length) onAdd(picked);
    onClose();
  }

  return (
    <Modal open={open} title="Alege din catalogul de prețuri" onClose={onClose}>
      <p className="text-sm text-slate-600">
        Catalogul conține doar <span className="font-semibold">denumirea și prețul</span>.
        Categoria și gramajul nu există aici — le completezi tu în tabel după adăugare.
      </p>

      <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} className="mt-3"
        placeholder={total ? `Caută printre ${total} produse…` : "Caută un produs…"} />

      <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-brand-100">
        {results === null ? (
          <div className="p-4"><Spinner label="Se caută..." /></div>
        ) : results.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">
            Niciun produs pentru „{q}". Poți adăuga rândul manual în tabel.
          </p>
        ) : (
          <ul className="divide-y divide-brand-50">
            {results.map((p) => {
              const count = picked.filter((x) => x.id === p.id).length;
              return (
                <li key={p.id}>
                  <button onClick={() => setPicked((prev) => [...prev, p])}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-brand-50">
                    <span className="min-w-0 flex-1 truncate text-ink">{p.name}</span>
                    {count > 0 && (
                      <span className="shrink-0 rounded-full bg-brand-500 px-2 py-0.5 text-xs font-bold text-white">
                        ×{count}
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {picked.length === 0
            ? "Niciun produs selectat."
            : `${picked.length} produs${picked.length === 1 ? "" : "e"} de adăugat.`}
          {picked.length > 0 && (
            <button onClick={() => setPicked([])} className="ml-2 text-red-600 underline">golește</button>
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Renunță</Button>
          <Button onClick={confirm} disabled={picked.length === 0}>
            Adaugă în tabel{picked.length ? ` (${picked.length})` : ""}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
