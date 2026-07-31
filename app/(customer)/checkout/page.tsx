"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart, useToast } from "@/components/providers";
import { Button, Card, EmptyState, Field, fmtMdl, Textarea, TimeSelect } from "@/components/ui";
import { PICKUP_LOCATIONS } from "@/lib/locations";
import { orderableDates, todayISO } from "@/lib/schedule";

/** "Astăzi · luni 28 iulie" / "Marți 29 iulie" for a YYYY-MM-DD option. */
function dayLabel(iso: string, today: string) {
  const s = new Date(`${iso}T12:00:00`).toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" });
  const cap = s.charAt(0).toUpperCase() + s.slice(1);
  return iso === today ? `Astăzi · ${s}` : cap;
}

/** Portion qualifier for a cart line: "250 g" or "/buc". */
function portion(l: { grams: number | null; unit?: string | null }) {
  if (l.grams && l.grams > 0) return `${l.grams} g`;
  if (l.unit) return `/${l.unit}`;
  return "";
}

export default function CheckoutPage() {
  const cart = useCart();
  const toast = useToast();
  const router = useRouter();
  const [pickupTime, setPickupTime] = useState("");
  const [pickupLocation, setPickupLocation] = useState<string>("");
  const [pickupDate, setPickupDate] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Live ordering availability (server is source of truth for the kill-switch,
  // today's working-day status and the same-day cutoff).
  const [avail, setAvail] = useState<{ ordersEnabled: boolean; cutoffPassed: boolean; workingDay: boolean; cutoff: string } | null>(null);

  // A Bucate-only cart can be scheduled for a future working day; any daily-menu
  // item forces the order to today.
  const bucateOnly = cart.lines.length > 0 && cart.lines.every((l) => l.source === "stable");
  const today = todayISO();

  // Working days the customer may pick (today dropped once the cutoff has passed).
  const dateOptions = useMemo(() => {
    let days = orderableDates();
    if (avail?.cutoffPassed) days = days.filter((d) => d !== today);
    return days;
  }, [avail, today]);

  // Keep the selected advance date valid as the option set changes.
  useEffect(() => {
    if (!bucateOnly) return;
    if (!pickupDate || !dateOptions.includes(pickupDate)) setPickupDate(dateOptions[0] ?? "");
  }, [bucateOnly, dateOptions, pickupDate]);

  async function refreshAvailability() {
    try {
      const d = await (await fetch("/api/menu/today")).json();
      setAvail({ ordersEnabled: !!d.ordersEnabled, cutoffPassed: !!d.cutoffPassed, workingDay: d.workingDay !== false, cutoff: d.cutoff ?? "10:30" });
    } catch { /* keep last known state */ }
  }

  useEffect(() => {
    refreshAvailability();
    const t = setInterval(refreshAvailability, 15000);
    return () => clearInterval(t);
  }, []);

  const cutoff = avail?.cutoff ?? "10:30";
  // Blocked-ordering reason (if any), depending on cart contents.
  let closed: string | null = null;
  if (avail && !avail.ordersEnabled) closed = "Momentan nu preluăm comenzi. Coșul rămâne salvat pentru mai târziu.";
  else if (bucateOnly) {
    if (dateOptions.length === 0) closed = "Nu există zile lucrătoare disponibile pentru comandă.";
  } else if (avail) {
    if (!avail.workingDay) closed = "Meniul zilei se comandă doar în zilele lucrătoare (luni–vineri).";
    else if (avail.cutoffPassed) closed = `Comenzile pentru azi s-au închis (ora limită ${avail.cutoff}).`;
  }

  async function submit() {
    setError("");
    if (closed) { setError(closed); return; }
    if (!pickupTime) { setError("Alegeți ora de ridicare."); return; }
    if (!pickupLocation) { setError("Alegeți punctul de ridicare."); return; }
    const pDate = bucateOnly ? pickupDate : today;
    if (bucateOnly && !pDate) { setError("Alegeți ziua comenzii."); return; }
    setLoading(true);
    const res = await fetch("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.lines.map((l) => ({ id: l.itemId, source: l.source, qty: l.qty })),
        pickupTime, pickupLocation, pickupDate: pDate, comment,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      if (res.status === 401) { router.push("/login?next=/checkout"); return; }
      // Backend is the source of truth: if it rejected because ordering closed,
      // surface that and lock the button.
      if (res.status === 403 || res.status === 400) refreshAvailability();
      setError(data.error || "Nu am putut trimite comanda.");
      return;
    }
    cart.clear();
    toast.push(`Comanda #${data.orderId} a fost trimisă!`);
    router.push("/orders");
  }

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-4 font-display text-2xl font-black text-brand-800">Coșul tău</h1>
        <EmptyState
          title="Coșul este gol"
          hint="Alege ceva bun din meniul de azi."
          action={<Link href="/order" className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600">Vezi meniul</Link>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="font-display text-2xl font-black text-brand-800">Finalizează comanda</h1>

      <Card className="divide-y divide-brand-100">
        {cart.lines.map((l) => (
          <div key={l.key} className="flex items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{l.name}</p>
              <p className="text-sm text-slate-500">
                {l.source === "stable" && <span className="mr-1 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-600">zilnic</span>}
                {portion(l)} · {fmtMdl(l.price)}{portion(l) ? "/porție" : ""}
                {(l.minQty ?? 1) > 1 && <span className="ml-1 font-semibold text-amber-700">· min. {l.minQty}</span>}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button aria-label="Scade" onClick={() => { const min = Math.max(1, l.minQty ?? 1); cart.setQty(l.key, l.qty - 1 < min ? 0 : l.qty - 1); }}
                className="h-8 w-8 rounded-full border border-brand-300 text-brand-700 hover:bg-brand-50">−</button>
              <span className="w-6 text-center font-bold tabular-nums">{l.qty}</span>
              <button aria-label="Crește" onClick={() => cart.setQty(l.key, l.qty + 1)}
                className="h-8 w-8 rounded-full border border-brand-300 text-brand-700 hover:bg-brand-50">+</button>
            </div>
            <p className="w-20 text-right font-semibold tabular-nums text-brand-700">{fmtMdl(l.price * l.qty)}</p>
          </div>
        ))}
        <div className="flex items-center justify-between px-5 py-4">
          <span className="font-display text-lg font-bold text-brand-800">Total</span>
          <span className="font-display text-lg font-black tabular-nums text-brand-700">{fmtMdl(cart.total)}</span>
        </div>
      </Card>

      <Card className="space-y-5 p-5">
        {closed && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{closed}</p>
        )}

        {bucateOnly ? (
          <Field label="Când vrei să ridici comanda?">
            <select value={pickupDate} onChange={(e) => setPickupDate(e.target.value)}
              className="w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm font-semibold text-brand-800 outline-none focus:border-brand-400">
              {dateOptions.map((d) => <option key={d} value={d}>{dayLabel(d, today)}</option>)}
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              Se comandă cu maxim 1 săptămână înainte (zile lucrătoare).
            </span>
          </Field>
        ) : (
          <p className="rounded-xl bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-700">
            Comandă pentru <span className="font-bold">astăzi</span> ({dayLabel(today, today).replace("Astăzi · ", "")}).
          </p>
        )}

        <Field label="Ora de ridicare">
          <TimeSelect value={pickupTime} onChange={setPickupTime} minuteStep={5} />
          <span className="mt-1 block text-xs text-slate-500">Alege ora la care vii să ridici comanda.</span>
        </Field>

        <Field label="Punct de ridicare">
          <div className="grid gap-2.5">
            {PICKUP_LOCATIONS.map((loc) => {
              const active = pickupLocation === loc.id;
              return (
                <button key={loc.id} type="button" onClick={() => setPickupLocation(loc.id)}
                  aria-pressed={active}
                  className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${active ? "border-brand-500 bg-brand-50" : "border-brand-200 hover:border-brand-300 hover:bg-brand-50/50"}`}>
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${active ? "border-brand-500 bg-brand-500" : "border-brand-300"}`}>
                    {active && <span className="h-2 w-2 rounded-full bg-white" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold text-brand-800">{loc.name}</span>
                    <span className="block text-sm text-slate-500">{loc.address}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Comentariu (opțional)">
          <Textarea rows={2} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="Ex.: fără smântână la ciorbă" />
        </Field>
        <p className="text-xs text-slate-500">
          Plata se face la ridicare, numerar sau card. Comenzile pentru azi se primesc până la ora {cutoff}.
          Comenzile se fac cu 24 de ore înainte și se preiau doar în zilele lucrătoare (luni–vineri).
        </p>
        {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{error}</p>}
        <Button full onClick={submit} disabled={loading || !!closed}>
          {closed ? "Comenzile sunt închise" : loading ? "Se trimite..." : `Trimite comanda · ${fmtMdl(cart.total)}`}
        </Button>
      </Card>
    </div>
  );
}
