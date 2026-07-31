"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, Modal, Spinner, Textarea, fmtMdl } from "@/components/ui";
import { useToast } from "@/components/providers";

type StableItem = {
  id: number; category: string; name: string; grams: number | null; unit: string;
  price_mdl: number; min_qty: number; description: string | null; image_url: string | null;
  available: number; sort_order: number;
};

const emptyDraft = { category: "Bucate la comandă", name: "", grams: "", unit: "buc", priceMdl: "", minQty: "", description: "", sortOrder: "" };

export default function AdminStableItemsPage() {
  const toast = useToast();
  const [items, setItems] = useState<StableItem[] | null>(null);
  const [draft, setDraft] = useState({ ...emptyDraft });
  const [confirmDelete, setConfirmDelete] = useState<StableItem | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/stable-items");
    const data = await res.json();
    setItems(data.items ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function addItem() {
    if (!draft.name.trim() || !(Number(draft.priceMdl) > 0)) {
      toast.push("Completați denumirea și prețul.", "error"); return;
    }
    const res = await fetch("/api/admin/stable-items", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft),
    });
    if (res.ok) { setDraft({ ...emptyDraft, category: draft.category }); toast.push("Produs adăugat."); load(); }
    else toast.push((await res.json()).error || "Eroare.", "error");
  }

  async function patchItem(id: number, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/stable-items/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!res.ok) toast.push((await res.json()).error || "Eroare la salvare.", "error");
    load();
  }

  async function uploadImage(id: number, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/admin/stable-items/${id}/image`, { method: "POST", body: fd });
    if (!res.ok) { toast.push((await res.json()).error || "Încărcarea imaginii a eșuat.", "error"); return; }
    toast.push("Imagine încărcată.");
    load();
  }

  async function deleteItem(it: StableItem) {
    await fetch(`/api/admin/stable-items/${it.id}`, { method: "DELETE" });
    setConfirmDelete(null);
    toast.push(`„${it.name}" a fost șters.`);
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-black text-brand-800">Produse permanente</h1>
        <p className="mt-1 text-sm text-slate-600">
          Produse disponibile în fiecare zi („Bucate la comandă"). Sunt separate de meniul zilei
          și <span className="font-semibold">nu</span> sunt afectate de încărcarea Excel a meniului zilnic.
        </p>
      </div>

      {items === null ? (
        <Spinner />
      ) : (
        <Card className="divide-y divide-brand-100">
          {items.length === 0 && <p className="px-5 py-6 text-sm text-slate-500">Niciun produs permanent încă — adăugați mai jos.</p>}
          {items.map((it) => (
            <StableRow key={it.id} item={it}
              onSave={(body) => patchItem(it.id, body)}
              onToggle={() => patchItem(it.id, { available: !it.available })}
              onUpload={(file) => uploadImage(it.id, file)}
              onDelete={() => setConfirmDelete(it)} />
          ))}
        </Card>
      )}

      <Card className="p-5">
        <h3 className="font-display font-bold text-brand-800">Adaugă produs permanent</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-7">
          <Input placeholder="Categorie" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
          <Input placeholder="Denumire" className="sm:col-span-2" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Input placeholder="Gramaj (opț.)" inputMode="numeric" value={draft.grams} onChange={(e) => setDraft({ ...draft, grams: e.target.value })} />
          <Input placeholder="Unitate (buc/kg)" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
          <Input placeholder="Preț MDL" inputMode="decimal" value={draft.priceMdl} onChange={(e) => setDraft({ ...draft, priceMdl: e.target.value })} />
          <Input placeholder="Cant. min." inputMode="numeric" value={draft.minQty} onChange={(e) => setDraft({ ...draft, minQty: e.target.value })} />
        </div>
        <Textarea className="mt-3" rows={2} maxLength={600} placeholder="Descriere (apare pe cardul din Bucate la comandă)"
          value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        <p className="mt-2 text-xs text-slate-500">„Cant. min." = cantitatea minimă pe care clientul o poate comanda (implicit 1). Imaginea se adaugă după creare, din listă.</p>
        <div className="mt-3"><Button small onClick={addItem}>Adaugă</Button></div>
      </Card>

      <Modal open={!!confirmDelete} title="Ștergi produsul?" onClose={() => setConfirmDelete(null)}>
        <p className="text-sm text-slate-600">„{confirmDelete?.name}" va fi eliminat definitiv din produsele permanente.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Renunță</Button>
          <Button variant="danger" onClick={() => confirmDelete && deleteItem(confirmDelete)}>Șterge</Button>
        </div>
      </Modal>
    </div>
  );
}

function StableRow({ item, onSave, onToggle, onUpload, onDelete }: {
  item: StableItem; onSave: (body: Record<string, unknown>) => void; onToggle: () => void;
  onUpload: (file: File) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [d, setD] = useState({
    category: item.category, name: item.name, grams: item.grams === null ? "" : String(item.grams),
    unit: item.unit, priceMdl: String(item.price_mdl), minQty: String(item.min_qty ?? 1),
    description: item.description ?? "", sortOrder: String(item.sort_order),
  });

  if (editing) {
    return (
      <div className="space-y-2 px-5 py-3">
        <div className="grid gap-2 sm:grid-cols-8 sm:items-center">
          <Input value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })} placeholder="Categorie" />
          <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} className="sm:col-span-2" placeholder="Denumire" />
          <Input value={d.grams} inputMode="numeric" onChange={(e) => setD({ ...d, grams: e.target.value })} placeholder="g" />
          <Input value={d.unit} onChange={(e) => setD({ ...d, unit: e.target.value })} placeholder="buc/kg" />
          <Input value={d.priceMdl} inputMode="decimal" onChange={(e) => setD({ ...d, priceMdl: e.target.value })} placeholder="MDL" />
          <Input value={d.minQty} inputMode="numeric" onChange={(e) => setD({ ...d, minQty: e.target.value })} placeholder="Cant. min." />
          <div className="flex gap-2">
            <Button small onClick={() => { onSave({ category: d.category, name: d.name, grams: d.grams, unit: d.unit, priceMdl: d.priceMdl, minQty: d.minQty, description: d.description, sortOrder: d.sortOrder }); setEditing(false); }}>Salvează</Button>
            <Button small variant="ghost" onClick={() => setEditing(false)}>Anulează</Button>
          </div>
        </div>
        <Textarea rows={2} maxLength={600} placeholder="Descriere" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
      </div>
    );
  }
  const portion = item.grams && item.grams > 0 ? `${item.grams} g` : `/${item.unit}`;
  return (
    <div className={`flex flex-wrap items-center gap-3 px-5 py-3 ${item.available ? "" : "opacity-50"}`}>
      {/* Thumbnail + upload */}
      <button type="button" onClick={() => fileRef.current?.click()} title="Schimbă imaginea"
        className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-brand-100 bg-brand-50">
        {item.image_url
          ? <img src={item.image_url} alt="" className="h-full w-full object-cover" />
          : <span className="flex h-full w-full items-center justify-center text-lg text-brand-300">🍽️</span>}
        <span className="absolute inset-x-0 bottom-0 bg-black/50 py-0.5 text-center text-[9px] font-bold text-white">FOTO</span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />

      <div className="min-w-0 flex-1">
        <span className="font-medium">
          {item.name}
          {item.min_qty > 1 && <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">min. {item.min_qty}</span>}
          {!item.available && <span className="ml-2 align-middle"><Badge tone="gray">Indisponibil</Badge></span>}
        </span>
        {item.description && <p className="truncate text-xs text-slate-500">{item.description}</p>}
      </div>
      <span className="text-sm text-slate-500">{portion}</span>
      <span className="w-24 text-right font-semibold tabular-nums text-brand-700">{fmtMdl(item.price_mdl)}</span>
      <div className="flex gap-1.5">
        <Button small variant="outline" onClick={() => fileRef.current?.click()}>{item.image_url ? "Schimbă foto" : "Adaugă foto"}</Button>
        <Button small variant="ghost" onClick={() => setEditing(true)}>Editează</Button>
        <Button small variant="outline" onClick={onToggle}>{item.available ? "Ascunde" : "Repune"}</Button>
        <Button small variant="ghost" onClick={onDelete}><span className="text-red-600">Șterge</span></Button>
      </div>
    </div>
  );
}
