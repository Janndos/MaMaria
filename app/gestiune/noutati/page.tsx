"use client";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, EmptyState, Field, Input, Modal, Spinner, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { MenuGenerator } from "./menu-generator";

type Post = { id: number; title: string; body: string; tg_url: string | null; posted_at: string };

export default function AdminNewsPage() {
  const toast = useToast();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [form, setForm] = useState({ title: "", body: "", tgUrl: "" });
  const [confirmDelete, setConfirmDelete] = useState<Post | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/news");
    setPosts((await res.json()).posts ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create() {
    const res = await fetch("/api/admin/news", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    if (!res.ok) { toast.push((await res.json()).error || "Eroare.", "error"); return; }
    setForm({ title: "", body: "", tgUrl: "" });
    toast.push("Noutatea a fost publicată.");
    load();
  }

  async function remove(p: Post) {
    await fetch(`/api/admin/news/${p.id}`, { method: "DELETE" });
    setConfirmDelete(null);
    toast.push("Noutatea a fost ștearsă.");
    load();
  }

  return (
    <div className="space-y-6">
      <MenuGenerator />

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="font-display text-lg font-bold text-brand-800">Publică o noutate</h2>
          <p className="mt-1 text-sm text-slate-600">
            Noutățile din canalul oficial Telegram se preiau manual în MVP (copiați textul și adăugați linkul postării).
            Sincronizarea automată se poate activa ulterior adăugând botul ca administrator al canalului.
          </p>
        </div>
        <Field label="Titlu"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Program special de sărbători" /></Field>
        <Field label="Text"><Textarea rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
        <Field label="Link postare Telegram (opțional)"><Input value={form.tgUrl} onChange={(e) => setForm({ ...form, tgUrl: e.target.value })} placeholder="https://t.me/mamaria_md/123" /></Field>
        <Button onClick={create}>Publică noutatea</Button>
      </Card>

      {posts === null ? <Spinner /> : posts.length === 0 ? (
        <EmptyState title="Nicio noutate publicată" hint="Prima noutate apare pe pagina principală și în panoul clienților." />
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <Card key={p.id} className="flex items-start justify-between gap-4 p-5">
              <div>
                <p className="font-display font-bold text-brand-800">{p.title}</p>
                <p className="mt-1 text-sm text-slate-600">{p.body}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {new Date(p.posted_at + "Z").toLocaleString("ro-RO")}
                  {p.tg_url && <> · <a className="text-brand-600 underline" href={p.tg_url} target="_blank" rel="noreferrer">Telegram</a></>}
                </p>
              </div>
              <Button small variant="ghost" onClick={() => setConfirmDelete(p)}><span className="text-red-600">Șterge</span></Button>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!confirmDelete} title="Ștergi noutatea?" onClose={() => setConfirmDelete(null)}>
        <p className="text-sm text-slate-600">„{confirmDelete?.title}" va dispărea de pe site. Acțiunea nu poate fi anulată.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Renunță</Button>
          <Button variant="danger" onClick={() => confirmDelete && remove(confirmDelete)}>Șterge</Button>
        </div>
      </Modal>
    </div>
  );
}
