import Link from "next/link";
import { getStableItems } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { MenuBoard } from "@/components/menu-board";
import { MenuTabs } from "@/components/menu-tabs";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BucatePage() {
  const user = await currentUser();
  const stableItems = getStableItems(true);
  const orderHref = user ? "/order" : "/login?next=/order";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl font-black text-brand-800">Bucate la comandă</h1>
        <Link href={orderHref}
          className="rounded-full bg-gold-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-gold-600 active:scale-95">
          Comandă acum
        </Link>
      </div>

      <MenuTabs active="bucate" />

      {stableItems.length ? (
        <MenuBoard source="stable" title="Produse disponibile zilnic" subtitle="Bucate la comandă" items={stableItems as any} interactive={false} />
      ) : (
        <EmptyState title="Nu există produse disponibile momentan"
          hint="Reveniți în curând — lista de bucate la comandă va apărea aici." />
      )}

      <p className="text-center text-xs text-slate-400">
        Aceste produse pot fi comandate în fiecare zi, alături de meniul zilei.
      </p>
    </div>
  );
}
