"use client";
import { useMemo } from "react";
import { useCart, useToast, cartKey, CartSource } from "./providers";
import { Badge, fmtMdl } from "./ui";

export type ApiMenuItem = {
  id: number; name: string; grams: number | null; price_mdl: number;
  available: number; category: string | null; unit?: string | null;
};

/** Short portion/price qualifier: "250 g", "buc", "kg" — whatever the item carries. */
function portionLabel(it: ApiMenuItem) {
  if (it.grams && it.grams > 0) return `${it.grams} g`;
  if (it.unit) return `/${it.unit}`;
  return "";
}

/** The signature element: a menu rendered like the printed sheet at the counter —
 *  teal masthead, category sections, dotted price leaders. Used for both the daily
 *  menu and the stable "Produse disponibile zilnic" catalogue. */
export function MenuBoard({
  title, subtitle, items, interactive = true, source = "daily",
}: {
  title: string; subtitle?: string; items: ApiMenuItem[];
  interactive?: boolean; source?: CartSource;
}) {
  const cart = useCart();
  const toast = useToast();

  const groups = useMemo(() => {
    const map = new Map<string, ApiMenuItem[]>();
    for (const it of items) {
      const key = it.category ?? "Diverse";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <div className="overflow-hidden rounded-card bg-white shadow-card">
      <div className="bg-brand-500 px-5 py-4 text-white sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-100">{title}</p>
        {subtitle && <p className="font-display text-xl font-semibold capitalize sm:text-2xl">{subtitle}</p>}
      </div>
      <div className="divide-y divide-brand-100">
        {groups.map(([cat, list]) => (
          <section key={cat} className="px-5 py-4 sm:px-8">
            <h3 className="font-display text-base font-bold uppercase tracking-wide text-brand-700">{cat}</h3>
            <ul className="mt-2 space-y-1">
              {list.map((it) => {
                const off = !it.available;
                const key = cartKey(source, it.id);
                const inCart = cart.lines.find((l) => l.key === key);
                const portion = portionLabel(it);
                return (
                  <li key={it.id} className={`flex items-end gap-1 py-1.5 ${off ? "opacity-45" : ""}`}>
                    <div className="min-w-0">
                      <span className="font-medium">{it.name}</span>
                      {portion && <span className="ml-2 whitespace-nowrap text-sm text-slate-500">{portion}</span>}
                      {off && <span className="ml-2 align-middle"><Badge tone="gray">Indisponibil</Badge></span>}
                    </div>
                    <span className="dotted-leader" aria-hidden />
                    <span className="whitespace-nowrap font-semibold tabular-nums text-brand-700">{fmtMdl(it.price_mdl)}</span>
                    {interactive && !off && (
                      inCart ? (
                        <span className="ml-2 flex items-center gap-1">
                          <button aria-label={`Scade cantitatea pentru ${it.name}`}
                            onClick={() => cart.setQty(key, inCart.qty - 1)}
                            className="h-7 w-7 rounded-full border border-brand-300 text-brand-700 hover:bg-brand-50">−</button>
                          <span className="w-5 text-center text-sm font-bold tabular-nums">{inCart.qty}</span>
                          <button aria-label={`Crește cantitatea pentru ${it.name}`}
                            onClick={() => cart.setQty(key, inCart.qty + 1)}
                            className="h-7 w-7 rounded-full border border-brand-300 text-brand-700 hover:bg-brand-50">+</button>
                        </span>
                      ) : (
                        <button
                          onClick={() => { cart.add({ source, itemId: it.id, name: it.name, grams: it.grams, unit: it.unit ?? null, price: it.price_mdl }); toast.push(`„${it.name}" adăugat în coș`); }}
                          className="ml-2 rounded-full bg-brand-500 px-3 py-1 text-xs font-bold text-white hover:bg-brand-600">
                          Adaugă
                        </button>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
