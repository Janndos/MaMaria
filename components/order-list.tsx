"use client";
import Link from "next/link";
import { Badge, Card, EmptyState, fmtMdl, ORDER_STATUS_RO } from "@/components/ui";
import { locationLabel } from "@/lib/locations";

export type CustomerOrder = {
  id: number; status: string; total_mdl: number; pickup_time: string;
  pickup_location: string | null; comment: string | null;
  cancellation_reason: string | null; created_at: string;
  items: { id: number; name: string; grams: number; unit: string | null; price_mdl: number; qty: number; source_type?: string }[];
};

function portion(it: { grams: number; unit: string | null }) {
  if (it.grams && it.grams > 0) return `${it.grams} g`;
  if (it.unit) return `/${it.unit}`;
  return "";
}

export function OrderList({ orders }: { orders: CustomerOrder[] }) {
  if (orders.length === 0) {
    return (
      <EmptyState title="Nu ai plasat nicio comandă încă."
        hint="Prima comandă e la un click distanță."
        action={<Link href="/menu" className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600">Vezi meniul de azi</Link>} />
    );
  }
  return (
    <div className="space-y-4">
      {orders.map((o) => {
        const st = ORDER_STATUS_RO[o.status] ?? { label: o.status, tone: "gray" as const };
        return (
          <Card key={o.id} className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-display font-bold text-brand-800">Comanda #{o.id}</p>
                <p className="text-sm text-slate-500">
                  {new Date(o.created_at + "Z").toLocaleString("ro-RO", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} · ridicare {o.pickup_time}
                </p>
              </div>
              <Badge tone={st.tone}>{st.label}</Badge>
            </div>

            {o.pickup_location && (
              <p className="mt-1 text-sm font-medium text-brand-700">📍 {locationLabel(o.pickup_location)}</p>
            )}

            {o.status === "cancelled" && o.cancellation_reason && (
              <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
                Comanda a fost anulată: {o.cancellation_reason}
              </p>
            )}

            <ul className="mt-3 space-y-1 text-sm">
              {o.items.map((it) => (
                <li key={it.id} className="flex items-end">
                  <span>{it.qty} × {it.name} {portion(it) && <span className="text-slate-400">({portion(it)})</span>}</span>
                  <span className="dotted-leader" aria-hidden />
                  <span className="font-semibold tabular-nums text-brand-700">{fmtMdl(it.price_mdl * it.qty)}</span>
                </li>
              ))}
            </ul>
            {o.comment && <p className="mt-2 text-sm italic text-slate-500">„{o.comment}"</p>}
            <p className="mt-3 border-t border-brand-100 pt-2 text-right font-bold tabular-nums text-brand-800">
              Total: {fmtMdl(o.total_mdl)}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
