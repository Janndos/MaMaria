"use client";
import { useState } from "react";
import { useCart, useToast, cartKey } from "./providers";
import { fmtMdl } from "./ui";
import type { ApiMenuItem } from "./menu-board";

// Session-scoped: the card entrance staggers only the first time the grid mounts,
// never again on tab switches / re-renders / filtering.
let bucateEntered = false;

/** Portion qualifier: "250 g", "/kg", "/buc". */
function portionLabel(it: ApiMenuItem) {
  if (it.grams && it.grams > 0) return `${it.grams} g`;
  if (it.unit) return `/${it.unit}`;
  return "";
}

/**
 * Image-first product menu for "Bucate la comandă" — a card grid with a photo,
 * name, description and price, so it reads like a real menu rather than the plain
 * daily-menu list.
 */
export function BucateMenu({ items, interactive = true }: { items: ApiMenuItem[]; interactive?: boolean }) {
  const cart = useCart();
  const toast = useToast();
  // Stagger the entrance on first mount only.
  const [stagger] = useState(() => { if (bucateEntered) return false; bucateEntered = true; return true; });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it, i) => {
        const off = !it.available;
        const key = cartKey("stable", it.id);
        const inCart = cart.lines.find((l) => l.key === key);
        const portion = portionLabel(it);
        const min = Math.max(1, it.min_qty ?? 1);
        const dec = () => cart.setQty(key, inCart!.qty - 1 < min ? 0 : inCart!.qty - 1);

        return (
          <article key={it.id}
            style={stagger ? { animationDelay: `${Math.min(i, 8) * 45}ms` } : undefined}
            className={`dish-card flex flex-col overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5 ${stagger ? "card-in" : ""} ${off ? "opacity-60" : "hover:shadow-lg"}`}>
            {/* Photo */}
            <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-brand-50 to-gold-50">
              {it.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.image_url} alt={it.name} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-5xl text-brand-200">🍽️</div>
              )}
              <span className="absolute right-2 top-2 rounded-full bg-white/95 px-3 py-1 text-sm font-black tabular-nums text-brand-700 shadow-sm">
                {fmtMdl(it.price_mdl)}
              </span>
              {off && (
                <span className="absolute inset-x-0 bottom-0 bg-ink/70 py-1 text-center text-xs font-bold uppercase tracking-wide text-white">
                  Indisponibil momentan
                </span>
              )}
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-[15px] font-bold leading-snug text-brand-800">{it.name}</h3>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                {portion && <span className="font-semibold text-slate-500">{portion}</span>}
                {min > 1 && <span className="rounded bg-amber-50 px-1.5 py-0.5 font-bold uppercase tracking-wide text-amber-700">min. {min}</span>}
              </div>
              {it.description && <p className="mt-2 text-sm leading-relaxed text-slate-500">{it.description}</p>}

              {/* `mt-auto` pins the action to the card's bottom edge, so buttons line
                  up across a row no matter how long each description is. */}
              {interactive && !off && (
                <div className="mt-auto pt-4">
                  {inCart ? (
                    <div className="flex items-center justify-between rounded-full bg-brand-50 p-1">
                      <button aria-label={`Scade cantitatea pentru ${it.name}`} onClick={dec}
                        className="h-9 w-9 rounded-full bg-white text-lg font-bold text-brand-700 shadow-sm hover:bg-brand-100">−</button>
                      <span className="min-w-[2rem] text-center font-bold tabular-nums text-brand-800">{inCart.qty}</span>
                      <button aria-label={`Crește cantitatea pentru ${it.name}`} onClick={() => cart.setQty(key, inCart.qty + 1)}
                        className="h-9 w-9 rounded-full bg-white text-lg font-bold text-brand-700 shadow-sm hover:bg-brand-100">+</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { cart.add({ source: "stable", itemId: it.id, name: it.name, grams: it.grams, unit: it.unit ?? null, price: it.price_mdl, minQty: min }, min); toast.push(min > 1 ? `„${it.name}" adăugat (min. ${min})` : `„${it.name}" adăugat în coș`); }}
                      className="w-full rounded-full border border-brand-300 bg-white py-2.5 text-sm font-semibold text-brand-700 transition duration-150 hover:border-brand-400 hover:bg-brand-50 active:scale-[0.98]">
                      Adaugă în coș
                    </button>
                  )}
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
