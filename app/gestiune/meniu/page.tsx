"use client";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Spinner, fmtMdl } from "@/components/ui";
import { useToast } from "@/components/providers";

type Item = { id: number; name: string; grams: number; price_mdl: number; available: number; category: string | null };
type Menu = { id: number; date: string; title: string; published: number };

function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function AdminMenuPage() {
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [menu, setMenu] = useState<Menu | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [newItem, setNewItem] = useState({ category: "", name: "", grams: "", priceMdl: "" });
  const [confirmDelete, setConfirmDelete] = useState<Item | null>(null);

  const load = useCallback(async () => {
    setItems(null);
    const res = await fetch(`/api/admin/menus?date=${date}`);
    const data = await res.json();
    setMenu(data.menu);
    setItems(data.items ?? []);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  async function createEmptyMenu() {
    const res = await fetch("/api/admin/menus", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date, title: "Meniul zilei",
        items: [{ category: "Diverse", name: "Exemplu — editați-mă", grams: 100, priceMdl: 10 }],
        publish: false,
      }),
    });
    if (res.ok) { toast.push("Meniu creat. Adăugați produsele."); load(); }
    else toast.push((await res.json()).error || "Eroare.", "error");
  }

  async function patchItem(id: number, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/items/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!res.ok) toast.push((await res.json()).error || "Eroare la salvare.", "error");
    load();
  }

  async function addItem() {
    if (!menu) return;
    const res = await fetch("/api/admin/items", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menuId: menu.id, ...newItem }),
    });
    if (res.ok) { setNewItem({ category: newItem.category, name: "", grams: "", priceMdl: "" }); toast.push("Produs adăugat."); load(); }
    else toast.push((await res.json()).error || "Eroare.", "error");
  }

  async function togglePublish() {
    if (!menu) return;
    const res = await fetch(`/api/admin/menus/${menu.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !menu.published }),
    });
    if (res.ok) { toast.push(menu.published ? "Meniul a fost retras." : "Meniul a fost publicat."); load(); }
  }

  async function deleteItem(it: Item) {
    await fetch(`/api/admin/items/${it.id}`, { method: "DELETE" });
    setConfirmDelete(null);
    toast.push(`„${it.name}" a fost șters.`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Data meniului">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </Field>
        {menu && (
          <div className="flex items-center gap-3 pb-1">
            <Badge tone={menu.published ? "green" : "gray"}>{menu.published ? "Publicat" : "Nepublicat"}</Badge>
            <Button small variant={menu.published ? "outline" : "primary"} onClick={togglePublish}>
              {menu.published ? "Retrage meniul" : "Publică meniul"}
            </Button>
          </div>
        )}
      </div>

      {items === null ? (
        <Spinner />
      ) : !menu ? (
        <EmptyState title={`Nu există meniu pentru ${date}`}
          hint="Creați un meniu gol și adăugați produse, sau folosiți Încarcă meniu pentru Excel/CSV."
          action={<Button onClick={createEmptyMenu}>Creează meniu pentru această dată</Button>} />
      ) : (
        <>
          <Card className="divide-y divide-brand-100">
            {items.length === 0 && <p className="px-5 py-6 text-sm text-slate-500">Meniul nu are produse încă — adăugați mai jos.</p>}
            {items.map((it) => (
              <ItemRow key={it.id} item={it} onSave={(body) => patchItem(it.id, body)}
                onToggle={() => patchItem(it.id, { available: !it.available })}
                onDelete={() => setConfirmDelete(it)} />
            ))}
          </Card>

          <Card className="p-5">
            <h3 className="font-display font-bold text-brand-800">Adaugă produs</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-5">
              <Input placeholder="Categorie" value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} />
              <Input placeholder="Denumire" className="sm:col-span-2" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
              <Input placeholder="Gramaj" inputMode="numeric" value={newItem.grams} onChange={(e) => setNewItem({ ...newItem, grams: e.target.value })} />
              <Input placeholder="Preț MDL" inputMode="decimal" value={newItem.priceMdl} onChange={(e) => setNewItem({ ...newItem, priceMdl: e.target.value })} />
            </div>
            <div className="mt-3"><Button small onClick={addItem}>Adaugă în meniu</Button></div>
          </Card>
        </>
      )}

      <Modal open={!!confirmDelete} title="Ștergi produsul?" onClose={() => setConfirmDelete(null)}>
        <p className="text-sm text-slate-600">„{confirmDelete?.name}" va fi eliminat din meniul acestei zile. Acțiunea nu poate fi anulată.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Renunță</Button>
          <Button variant="danger" onClick={() => confirmDelete && deleteItem(confirmDelete)}>Șterge</Button>
        </div>
      </Modal>
    </div>
  );
}

function ItemRow({ item, onSave, onToggle, onDelete }: {
  item: Item; onSave: (body: Record<string, unknown>) => void; onToggle: () => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ category: item.category ?? "", name: item.name, grams: String(item.grams), priceMdl: String(item.price_mdl) });

  if (editing) {
    return (
      <div className="grid gap-2 px-5 py-3 sm:grid-cols-6 sm:items-center">
        <Input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="Categorie" />
        <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="sm:col-span-2" />
        <Input value={draft.grams} inputMode="numeric" onChange={(e) => setDraft({ ...draft, grams: e.target.value })} />
        <Input value={draft.priceMdl} inputMode="decimal" onChange={(e) => setDraft({ ...draft, priceMdl: e.target.value })} />
        <div className="flex gap-2">
          <Button small onClick={() => { onSave({ category: draft.category, name: draft.name, grams: draft.grams, priceMdl: draft.priceMdl }); setEditing(false); }}>Salvează</Button>
          <Button small variant="ghost" onClick={() => setEditing(false)}>Anulează</Button>
        </div>
      </div>
    );
  }
  return (
    <div className={`flex flex-wrap items-center gap-2 px-5 py-3 ${item.available ? "" : "opacity-50"}`}>
      <span className="w-32 shrink-0 text-xs font-semibold uppercase tracking-wide text-gold-600">{item.category ?? "Diverse"}</span>
      <span className="min-w-0 flex-1 font-medium">{item.name}</span>
      <span className="text-sm text-slate-500">{item.grams} g</span>
      <span className="w-20 text-right font-semibold tabular-nums text-brand-700">{fmtMdl(item.price_mdl)}</span>
      <div className="flex gap-1.5">
        <Button small variant="ghost" onClick={() => setEditing(true)}>Editează</Button>
        <Button small variant="outline" onClick={onToggle}>{item.available ? "Marchează indisponibil" : "Repune"}</Button>
        <Button small variant="ghost" onClick={onDelete}><span className="text-red-600">Șterge</span></Button>
      </div>
    </div>
  );
}
