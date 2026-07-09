"use client";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, Modal, Spinner, fmtMdl } from "@/components/ui";
import { useToast } from "@/components/providers";

type StableItem = {
  id: number; category: string; name: string; grams: number | null; unit: string;
  price_mdl: number; available: number; sort_order: number;
};

const emptyDraft = { category: "Bucate la comandă", name: "", grams: "", unit: "buc", priceMdl: "", sortOrder: "" };

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
              onDelete={() => setConfirmDelete(it)} />
          ))}
        </Card>
      )}

      <Card className="p-5">
        <h3 className="font-display font-bold text-brand-800">Adaugă produs permanent</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-6">
          <Input placeholder="Categorie" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
          <Input placeholder="Denumire" className="sm:col-span-2" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Input placeholder="Gramaj (opț.)" inputMode="numeric" value={draft.grams} onChange={(e) => setDraft({ ...draft, grams: e.target.value })} />
          <Input placeholder="Unitate (buc/kg)" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
          <Input placeholder="Preț MDL" inputMode="decimal" value={draft.priceMdl} onChange={(e) => setDraft({ ...draft, priceMdl: e.target.value })} />
        </div>
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

function StableRow({ item, onSave, onToggle, onDelete }: {
  item: StableItem; onSave: (body: Record<string, unknown>) => void; onToggle: () => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [d, setD] = useState({
    category: item.category, name: item.name, grams: item.grams === null ? "" : String(item.grams),
    unit: item.unit, priceMdl: String(item.price_mdl), sortOrder: String(item.sort_order),
  });

  if (editing) {
    return (
      <div className="grid gap-2 px-5 py-3 sm:grid-cols-7 sm:items-center">
        <Input value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })} placeholder="Categorie" />
        <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} className="sm:col-span-2" placeholder="Denumire" />
        <Input value={d.grams} inputMode="numeric" onChange={(e) => setD({ ...d, grams: e.target.value })} placeholder="g" />
        <Input value={d.unit} onChange={(e) => setD({ ...d, unit: e.target.value })} placeholder="buc/kg" />
        <Input value={d.priceMdl} inputMode="decimal" onChange={(e) => setD({ ...d, priceMdl: e.target.value })} placeholder="MDL" />
        <div className="flex gap-2">
          <Button small onClick={() => { onSave({ category: d.category, name: d.name, grams: d.grams, unit: d.unit, priceMdl: d.priceMdl, sortOrder: d.sortOrder }); setEditing(false); }}>Salvează</Button>
          <Button small variant="ghost" onClick={() => setEditing(false)}>Anulează</Button>
        </div>
      </div>
    );
  }
  const portion = item.grams && item.grams > 0 ? `${item.grams} g` : `/${item.unit}`;
  return (
    <div className={`flex flex-wrap items-center gap-2 px-5 py-3 ${item.available ? "" : "opacity-50"}`}>
      <span className="w-40 shrink-0 text-xs font-semibold uppercase tracking-wide text-gold-600">{item.category}</span>
      <span className="min-w-0 flex-1 font-medium">{item.name}</span>
      <span className="text-sm text-slate-500">{portion}</span>
      <span className="w-24 text-right font-semibold tabular-nums text-brand-700">{fmtMdl(item.price_mdl)}</span>
      {!item.available && <Badge tone="gray">Indisponibil</Badge>}
      <div className="flex gap-1.5">
        <Button small variant="ghost" onClick={() => setEditing(true)}>Editează</Button>
        <Button small variant="outline" onClick={onToggle}>{item.available ? "Marchează indisponibil" : "Repune"}</Button>
        <Button small variant="ghost" onClick={onDelete}><span className="text-red-600">Șterge</span></Button>
      </div>
    </div>
  );
}
