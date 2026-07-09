"use client";
import { useState } from "react";
import { Button, TimeSelect } from "@/components/ui";
import { useToast } from "@/components/providers";

export function CutoffForm({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const toast = useToast();
  async function save() {
    const res = await fetch("/api/admin/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderCutoff: value }),
    });
    const data = await res.json();
    if (!res.ok) toast.push(data.error || "Eroare la salvare.", "error");
    else toast.push("Ora limită a fost salvată.");
  }
  return (
    <div className="mt-2 flex items-end gap-3">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-brand-800">Ora limită pentru comenzile zilei</span>
        <TimeSelect value={value} onChange={setValue} minuteStep={5} />
      </label>
      <Button onClick={save}>Salvează</Button>
    </div>
  );
}
