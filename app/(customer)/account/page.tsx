import { requireUser } from "@/lib/auth";
import { Badge, Card } from "@/components/ui";
import { AccountOrders } from "./orders-client";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-black text-brand-800">Contul meu</h1>
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 font-display text-xl font-black text-white">
            {user.full_name.trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold text-brand-800">{user.full_name}</p>
            <p className="text-sm tabular-nums text-slate-500">{user.phone}</p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-brand-50 p-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-brand-600">Telefon</dt>
            <dd className="mt-1">{user.phone_verified ? <Badge tone="green">Confirmat</Badge> : <Badge tone="red">Neconfirmat</Badge>}</dd>
          </div>
          <div className="rounded-xl bg-brand-50 p-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-brand-600">Client din</dt>
            <dd className="mt-1 font-semibold text-ink">
              {new Date(user.created_at + "Z").toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })}
            </dd>
          </div>
        </dl>
      </Card>
      <div>
        <h2 className="mb-3 font-display text-lg font-bold text-brand-800">Istoricul comenzilor</h2>
        <AccountOrders />
      </div>
    </div>
  );
}
