"use client";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { useToast } from "@/components/providers";

export function TelegramForm({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const toast = useToast();
  async function save() {
    const res = await fetch("/api/admin/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegramUrl: value }),
    });
    if (!res.ok) toast.push((await res.json()).error || "Eroare la salvare.", "error");
    else toast.push("Linkul Telegram a fost salvat.");
  }
  return (
    <div className="mt-2 flex items-end gap-3">
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://t.me/..." className="max-w-sm" />
      <Button onClick={save}>Salvează</Button>
    </div>
  );
}
