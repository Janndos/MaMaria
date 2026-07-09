import Link from "next/link";
import db, { getMenuByDate, todayISO, getSetting } from "@/lib/db";
import { OrdersToggle } from "./orders-toggle";

export const dynamic = "force-dynamic";

export default function AdminOverview() {
  const today = todayISO();
  const menu = getMenuByDate(today);
  const counts = {
    ordersToday: (db.prepare("SELECT COUNT(*) c FROM orders WHERE date(created_at) = ?").get(today) as any).c,
    pending: (db.prepare("SELECT COUNT(*) c FROM orders WHERE status = 'pending'").get() as any).c,
    users: (db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'customer'").get() as any).c,
    revenueToday: (db.prepare("SELECT COALESCE(SUM(total_mdl),0) s FROM orders WHERE date(created_at) = ? AND status != 'cancelled'").get(today) as any).s,
  };
  const cutoff = getSetting("order_cutoff", "10:30");
  const ordersEnabled = getSetting("orders_enabled", "true") === "true";

  const stats = [
    { label: "Comenzi azi", value: counts.ordersToday, href: "/gestiune/comenzi" },
    { label: "În așteptare", value: counts.pending, href: "/gestiune/comenzi" },
    { label: "Încasări azi (MDL)", value: counts.revenueToday, href: "/gestiune/comenzi" },
    { label: "Clienți înregistrați", value: counts.users, href: "/gestiune/utilizatori" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-card bg-white p-5 shadow-card hover:shadow-md">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
            <p className="mt-1 font-display text-3xl font-black tabular-nums text-brand-700">{s.value}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-card bg-white p-5 shadow-card">
        <h2 className="font-display text-lg font-bold text-brand-800">Meniul de azi</h2>
        {menu ? (
          <p className="mt-1 text-sm text-slate-600">
            {menu.title} · {menu.published ? "✅ publicat" : "⏸ nepublicat"} —{" "}
            <Link href="/gestiune/meniu" className="font-semibold text-brand-600 underline">gestionează</Link>
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-600">
            Niciun meniu pentru azi.{" "}
            <Link href="/gestiune/incarca" className="font-semibold text-brand-600 underline">Încarcă un fișier</Link> sau{" "}
            <Link href="/gestiune/meniu" className="font-semibold text-brand-600 underline">introdu manual</Link>.
          </p>
        )}
      </div>

      <div className="rounded-card bg-white p-5 shadow-card">
        <h2 className="font-display text-lg font-bold text-brand-800">Preluarea comenzilor</h2>
        <p className="mt-1 text-sm text-slate-600">
          Ora limită de azi: <strong>{cutoff}</strong> —{" "}
          <Link href="/gestiune/setari" className="font-semibold text-brand-600 underline">modifică în Setări</Link>
        </p>
        <div className="mt-3"><OrdersToggle initial={ordersEnabled} /></div>
      </div>
    </div>
  );
}
