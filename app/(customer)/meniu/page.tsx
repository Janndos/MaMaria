"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MenuBoard, ApiMenuItem } from "@/components/menu-board";
import { BucateMenu } from "@/components/bucate-menu";
import { EmptyState, Spinner } from "@/components/ui";
import { useCart, useToast } from "@/components/providers";

type MenuResp = {
  menu: { id: number; date: string; title: string } | null;
  items: ApiMenuItem[];
  stableItems: ApiMenuItem[];
  cutoff: string;
  ordersEnabled: boolean;
  cutoffPassed: boolean;
  workingDay: boolean;
};

type Tab = "azi" | "programare";

function roDate(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" });
}

/** Capitalised "Luni, 1 august" for the header subline. */
function todayLabel() {
  const s = new Date().toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function MeniuPage() {
  const [data, setData] = useState<MenuResp | null>(null);
  const [tab, setTab] = useState<Tab>("azi");
  const cart = useCart();
  const toast = useToast();
  const staleChecked = useRef(false);

  useEffect(() => {
    fetch("/api/menu/today").then((r) => r.json()).then((d: MenuResp) => {
      setData(d);
      // Open on "Programare" when today's menu can't be ordered right now.
      const dailyOpen = !!d.menu && !d.cutoffPassed && d.workingDay !== false;
      if (!dailyOpen && d.stableItems.length) setTab("programare");
    });
  }, []);

  // Clear stale daily items if the cart still holds a previous day's menu.
  useEffect(() => {
    if (!data?.menu || staleChecked.current) return;
    staleChecked.current = true;
    if (cart.syncDate(data.menu.date)) {
      toast.push("Coșul conținea produse dintr-o zi anterioară și a fost actualizat.");
    }
  }, [data, cart, toast]);

  if (!data) return <Spinner label="Se încarcă meniul..." />;

  // Global kill-switch blocks everything.
  if (!data.ordersEnabled) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center">
        <span className="text-6xl" role="img" aria-label="trist">😔</span>
        <h1 className="font-display text-title font-medium text-brand-800">Momentan nu preluăm comenzi</h1>
        <p className="max-w-[30ch] text-slate-500">Te rugăm să revii mai târziu. Meniul rămâne vizibil oricând.</p>
      </div>
    );
  }

  const hasStable = data.stableItems.length > 0;
  // The daily menu is same-day only, so it closes after the cutoff / on weekends.
  const dailyOpen = !!data.menu && !data.cutoffPassed && data.workingDay;
  const dailyClosedMsg = !data.workingDay
    ? "Meniul zilei se comandă doar în zilele lucrătoare (luni–vineri)."
    : data.cutoffPassed
      ? `Comenzile din meniul zilei pentru azi s-au închis (ora limită ${data.cutoff}).`
      : "";

  if (!data.menu && !hasStable) {
    return <EmptyState title="Meniul de azi nu este publicat încă"
      hint="Comenzile se deschid imediat ce meniul apare. Reveniți puțin mai târziu!" />;
  }

  const helper = tab === "azi"
    ? `Din meniul zilei · comenzi acceptate până la ${data.cutoff}`
    : "Bucate la comandă · până la o săptămână înainte, zile lucrătoare";

  return (
    <div className="space-y-5">
      {/* Header: title + muted subline (day · cutoff) on the left, single gold
          primary action on the right, baseline-aligned. */}
      <header className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-display font-medium text-brand-800">Meniu</h1>
          <p className="mt-1 truncate text-sm text-slate-500">
            {todayLabel()} · comenzi până la {data.cutoff}
          </p>
        </div>
        <Link href="/checkout"
          className="shrink-0 rounded-full bg-gold-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-gold-600 active:scale-95">
          Comandă acum
        </Link>
      </header>

      {/* The single page-level order-type switcher (nav is the only page switcher). */}
      <div>
        <div role="tablist" aria-label="Tip comandă"
          className="relative grid grid-cols-2 rounded-full bg-brand-50 p-1 text-sm font-medium">
          <span aria-hidden
            className="pointer-events-none absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-full bg-brand-500 shadow-sm will-change-transform transition-transform duration-200 [transition-timing-function:var(--ease-out)]"
            style={{ transform: tab === "programare" ? "translateX(100%)" : "translateX(0)" }} />
          <button role="tab" aria-selected={tab === "azi"} onClick={() => setTab("azi")}
            className={`relative z-10 rounded-full px-4 py-2 text-center transition-colors ${tab === "azi" ? "text-white" : "text-brand-700"}`}>
            Pentru azi
          </button>
          <button role="tab" aria-selected={tab === "programare"} onClick={() => setTab("programare")}
            className={`relative z-10 rounded-full px-4 py-2 text-center transition-colors ${tab === "programare" ? "text-white" : "text-brand-700"}`}>
            Programare
          </button>
        </div>
        {/* One helper line that follows the selected tab. */}
        <p className="mt-2 px-1 text-xs text-slate-500">{helper}</p>
      </div>

      {/* Keyed by tab so the incoming panel cross-fades up on switch. */}
      <div key={tab} className="tab-panel">
        {tab === "azi" ? (
          data.menu ? (
            <div className="space-y-3">
              {!dailyOpen && (
                <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                  {dailyClosedMsg} Poți comanda din „Programare” pentru o zi viitoare.
                </p>
              )}
              <MenuBoard source="daily" title={data.menu.title || "Meniul zilei"} subtitle={roDate(data.menu.date)}
                items={data.items} interactive={dailyOpen} />
            </div>
          ) : (
            <EmptyState title="Meniul zilei nu este publicat încă"
              hint="Poți comanda din „Programare” între timp." />
          )
        ) : (
          hasStable ? (
            <BucateMenu items={data.stableItems} interactive />
          ) : (
            <EmptyState title="Nu există bucate la comandă momentan" />
          )
        )}
      </div>
    </div>
  );
}
