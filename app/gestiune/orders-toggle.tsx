"use client";
import { useState } from "react";
import { useToast } from "@/components/providers";

export function OrdersToggle({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function toggle() {
    setSaving(true);
    const next = !enabled;
    const res = await fetch("/api/admin/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ordersEnabled: next }),
    });
    setSaving(false);
    if (!res.ok) { toast.push("Eroare la salvare.", "error"); return; }
    setEnabled(next);
    toast.push(next ? "Comenzile au fost pornite." : "Comenzile au fost oprite.");
  }

  return (
    <button onClick={toggle} disabled={saving}
      className={`flex items-center gap-3 rounded-2xl border-2 px-5 py-3.5 font-bold transition active:scale-[0.98] ${
        enabled ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
      <span className={`relative h-6 w-11 rounded-full transition ${enabled ? "bg-green-500" : "bg-red-400"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? "left-[22px]" : "left-0.5"}`} />
      </span>
      {enabled ? "Comenzile sunt pornite" : "Comenzile sunt oprite"}
    </button>
  );
}
