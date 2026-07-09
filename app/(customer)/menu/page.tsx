import Link from "next/link";
import { getMenuByDate, getMenuItems, todayISO } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { MenuBoard } from "@/components/menu-board";
import { MenuTabs } from "@/components/menu-tabs";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

function roDate(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" });
}

export default async function MenuPage() {
  const user = await currentUser();
  const menu = getMenuByDate(todayISO());
  const items = menu?.published ? getMenuItems(menu.id) : [];
  const orderHref = user ? "/order" : "/login?next=/order";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl font-black text-brand-800">Meniul zilei</h1>
        <Link href={orderHref}
          className="rounded-full bg-gold-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-gold-600 active:scale-95">
          Comandă acum
        </Link>
      </div>

      <MenuTabs active="zilei" />

      {menu?.published && items.length ? (
        <MenuBoard source="daily" title={menu.title || "Meniul zilei"} subtitle={roDate(menu.date)} items={items as any} interactive={false} />
      ) : (
        <EmptyState title="Meniul de azi nu este publicat încă"
          hint="Meniul apare aici în fiecare dimineață. Reveniți puțin mai târziu!" />
      )}

      <p className="text-center text-xs text-slate-400">
        Pentru a comanda ai nevoie de un cont cu numărul de telefon confirmat.
      </p>
    </div>
  );
}
