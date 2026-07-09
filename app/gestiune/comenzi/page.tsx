"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, EmptyState, fmtMdl, Modal, ORDER_STATUS_RO, Spinner, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { locationLabel } from "@/lib/locations";

const STATUSES = ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"] as const;

type Order = {
  id: number; status: string; total_mdl: number; pickup_time: string;
  pickup_location: string | null; comment: string | null; cancellation_reason: string | null;
  created_at: string; full_name: string; phone: string;
  items: { id: number; name: string; grams: number; unit: string | null; price_mdl: number; qty: number; source_type?: string }[];
};

function portion(it: { grams: number; unit: string | null }) {
  if (it.grams && it.grams > 0) return `${it.grams} g`;
  if (it.unit) return `/${it.unit}`;
  return "";
}

/** Short two-tone "new order" chime generated in-browser (no audio asset needed). */
function useOrderChime() {
  const ctxRef = useRef<AudioContext | null>(null);
  const enable = useCallback(() => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      ctxRef.current = new AC();
    }
    ctxRef.current?.resume();
  }, []);
  const play = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    // Two rising blips, like a fast-food order bell.
    [[880, 0], [1320, 0.16]].forEach(([freq, at]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq as number;
      const t0 = now + (at as number);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.4, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.3);
    });
  }, []);
  return { enable, play };
}

export default function AdminOrdersPage() {
  const toast = useToast();
  const chime = useOrderChime();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [soundOn, setSoundOn] = useState(false);
  const [cancelling, setCancelling] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const maxSeenRef = useRef<number>(-1); // highest order id ever observed
  const soundRef = useRef(false);
  useEffect(() => { soundRef.current = soundOn; }, [soundOn]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/orders${filter ? `?status=${filter}` : ""}`);
    const data = await res.json();
    const list: Order[] = data.orders ?? [];
    const maxId = list.reduce((m, o) => Math.max(m, o.id), -1);

    if (maxSeenRef.current === -1) {
      // First load ever — establish the baseline, never chime for existing orders.
      maxSeenRef.current = maxId;
    } else if (maxId > maxSeenRef.current) {
      if (soundRef.current) chime.play();
      maxSeenRef.current = maxId;
    }
    setOrders(list);
  }, [filter, chime]);

  // Poll every 5s for new orders.
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  function enableSound() {
    chime.enable();
    setSoundOn(true);
    toast.push("Sunetul pentru comenzi noi este activ.");
  }

  async function setStatus(id: number, status: string, cancellationReason?: string) {
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, cancellationReason }),
    });
    if (!res.ok) toast.push((await res.json()).error || "Eroare.", "error");
    else toast.push(`Comanda #${id}: ${ORDER_STATUS_RO[status].label}.`);
    load();
  }

  function confirmCancel() {
    if (!cancelling) return;
    if (!cancelReason.trim()) { toast.push("Introduceți motivul anulării.", "error"); return; }
    setStatus(cancelling.id, "cancelled", cancelReason.trim());
    setCancelling(null);
    setCancelReason("");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilter("")}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${filter === "" ? "bg-brand-500 text-white" : "border border-brand-200 text-brand-700"}`}>
            Toate
          </button>
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${filter === s ? "bg-brand-500 text-white" : "border border-brand-200 text-brand-700"}`}>
              {ORDER_STATUS_RO[s].label}
            </button>
          ))}
        </div>
        {soundOn ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700">
            🔔 Sunet activ
          </span>
        ) : (
          <Button small variant="outline" onClick={enableSound}>🔔 Activează sunetul pentru comenzi</Button>
        )}
      </div>

      {orders === null ? (
        <Spinner label="Se încarcă comenzile..." />
      ) : orders.length === 0 ? (
        <EmptyState title="Nicio comandă aici" hint="Comenzile noi apar automat în această listă." />
      ) : (
        <div className="space-y-4">
          {orders.map((o) => {
            const st = ORDER_STATUS_RO[o.status] ?? { label: o.status, tone: "gray" as const };
            return (
              <Card key={o.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display font-bold text-brand-800">
                      #{o.id} · {o.full_name}
                      <a href={`tel:${o.phone}`} className="ml-2 text-sm font-semibold text-brand-600 underline">{o.phone}</a>
                    </p>
                    <p className="text-sm text-slate-500">
                      {new Date(o.created_at + "Z").toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })} · ridicare {o.pickup_time}
                    </p>
                    {o.pickup_location && <p className="text-sm font-medium text-brand-700">📍 {locationLabel(o.pickup_location)}</p>}
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <ul className="mt-3 space-y-0.5 text-sm">
                  {o.items.map((it) => (
                    <li key={it.id}>
                      {it.qty} × {it.name} {portion(it) && <span className="text-slate-400">({portion(it)})</span>}
                      {it.source_type === "stable" && <span className="ml-1 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-600">zilnic</span>}
                      {" "}— <span className="font-semibold tabular-nums">{fmtMdl(it.price_mdl * it.qty)}</span>
                    </li>
                  ))}
                </ul>
                {o.comment && <p className="mt-2 text-sm italic text-slate-500">„{o.comment}"</p>}
                {o.status === "cancelled" && o.cancellation_reason && (
                  <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">Motiv anulare: {o.cancellation_reason}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-brand-100 pt-3">
                  <p className="font-bold tabular-nums text-brand-800">Total: {fmtMdl(o.total_mdl)}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUSES.filter((s) => s !== o.status).map((s) => (
                      <button key={s}
                        onClick={() => (s === "cancelled" ? (setCancelling(o), setCancelReason("")) : setStatus(o.id, s))}
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${s === "cancelled" ? "border-red-200 text-red-600 hover:bg-red-50" : "border-brand-200 text-brand-700 hover:bg-brand-50"}`}>
                        {ORDER_STATUS_RO[s].label}
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={!!cancelling} title={`Anulează comanda #${cancelling?.id ?? ""}`} onClose={() => setCancelling(null)}>
        <label className="block text-sm font-semibold text-brand-800">Motivul anulării</label>
        <Textarea rows={3} maxLength={500} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
          className="mt-1.5" placeholder="Ex: Produsul nu mai este disponibil." />
        <p className="mt-1 text-xs text-slate-500">Clientul va vedea acest mesaj în istoricul comenzilor sale.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setCancelling(null)}>Renunță</Button>
          <Button variant="danger" onClick={confirmCancel}>Anulează comanda</Button>
        </div>
      </Modal>
    </div>
  );
}
