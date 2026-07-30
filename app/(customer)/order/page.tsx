"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MenuBoard, ApiMenuItem } from "@/components/menu-board";
import { MenuTabs } from "@/components/menu-tabs";
import { EmptyState, Spinner, fmtMdl } from "@/components/ui";
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

function roDate(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" });
}

export default function OrderPage() {
  const [data, setData] = useState<MenuResp | null>(null);
  const [tab, setTab] = useState<"zilei" | "bucate">("zilei");
  const cart = useCart();
  const toast = useToast();
  const staleChecked = useRef(false);

  useEffect(() => {
    fetch("/api/menu/today").then((r) => r.json()).then((d: MenuResp) => {
      setData(d);
      // Open on the catalogue when today's menu can't be ordered right now.
      const dailyOpen = !!d.menu && !d.cutoffPassed && d.workingDay !== false;
      if (!dailyOpen && d.stableItems.length) setTab("bucate");
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
        <h1 className="font-display text-xl font-black text-brand-800">Momentan nu preluăm comenzi</h1>
        <p className="max-w-[30ch] text-slate-500">Te rugăm să revii mai târziu. Meniul rămâne vizibil oricând.</p>
        <Link href="/menu" className="rounded-full bg-brand-500 px-6 py-3 font-bold text-white hover:bg-brand-600">
          Vezi meniul
        </Link>
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

  return (
    <div className="space-y-4">
      <MenuTabs active="comanda" />

      <div>
        <h1 className="font-display text-xl font-black text-brand-800">Comandă acum</h1>
        <p className="text-sm text-slate-500">
          Meniul zilei se comandă pentru azi (până la ora {data.cutoff}). „Bucate la comandă" se pot programa pentru o zi lucrătoare viitoare.
        </p>
      </div>

      {/* Sub-tabs: daily menu vs. "Bucate la comandă" — one shared cart. */}
      <div className="flex rounded-full bg-brand-50 p-1 text-sm font-semibold">
        <button onClick={() => setTab("zilei")}
          className={`flex-1 rounded-full px-4 py-2 transition ${tab === "zilei" ? "bg-brand-500 text-white shadow-sm" : "text-brand-700"}`}>
          Meniul zilei
        </button>
        <button onClick={() => setTab("bucate")}
          className={`flex-1 rounded-full px-4 py-2 transition ${tab === "bucate" ? "bg-brand-500 text-white shadow-sm" : "text-brand-700"}`}>
          Bucate la comandă
        </button>
      </div>

      {tab === "zilei" ? (
        data.menu ? (
          <div className="space-y-3">
            {!dailyOpen && (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                {dailyClosedMsg} Poți comanda din „Bucate la comandă" pentru o zi viitoare.
              </p>
            )}
            <MenuBoard source="daily" title={data.menu.title || "Meniul zilei"} subtitle={roDate(data.menu.date)}
              items={data.items} interactive={dailyOpen} />
          </div>
        ) : (
          <EmptyState title="Meniul zilei nu este publicat încă"
            hint="Poți comanda din secțiunea Bucate la comandă între timp." />
        )
      ) : (
        hasStable ? (
          <MenuBoard source="stable" title="Bucate la comandă" subtitle="Se pot programa în avans" items={data.stableItems} interactive />
        ) : (
          <EmptyState title="Nu există bucate la comandă momentan" />
        )
      )}

      {cart.count > 0 && (
        <div className="sticky bottom-3 z-20">
          <Link href="/checkout"
            className="flex items-center justify-between rounded-2xl bg-brand-600 px-5 py-4 font-bold text-white shadow-2xl transition hover:bg-brand-700 active:scale-[0.98]">
            <span>Finalizează comanda</span>
            <span className="rounded-full bg-white/20 px-3 py-1 text-sm tabular-nums">
              {cart.count} · {fmtMdl(cart.total)}
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
