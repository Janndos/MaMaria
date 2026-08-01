"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, EmptyState, Field, Input, Modal, Spinner, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { MenuGenerator } from "./menu-generator";

type Post = { id: number; title: string; body: string; image_url: string | null; tg_url: string | null; posted_at: string };

export default function AdminNewsPage() {
  const toast = useToast();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [form, setForm] = useState({ title: "", body: "" });
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Post | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/news");
    setPosts((await res.json()).posts ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  function clearImage() {
    setImage(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function create() {
    if (!form.title.trim() || !form.body.trim()) { toast.push("Completați titlul și textul.", "error"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("body", form.body);
      if (image) fd.append("image", image);
      const res = await fetch("/api/admin/news", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { toast.push(data.error || "Eroare.", "error"); return; }
      setForm({ title: "", body: "" });
      clearImage();
      // The post is saved regardless; surface how the Telegram side went.
      if (data.telegram?.posted) toast.push("Noutatea a fost publicată și postată pe Telegram.");
      else toast.push(data.telegram?.error || "Noutatea a fost salvată pe site (Telegram nu a răspuns).");
      load();
    } catch {
      toast.push("Eroare de rețea.", "error");
    } finally {
      setBusy(false);
    }
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
            Botul postează automat anunțul pe canalul Telegram. Dacă adaugi o imagine, aceasta este
            trimisă împreună cu textul (ca poză cu descriere).
          </p>
        </div>
        <Field label="Titlu"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Program special de sărbători" /></Field>
        <Field label="Text"><Textarea rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-brand-800">Imagine (opțional)</span>
          <div className="flex flex-wrap items-center gap-3">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
            <Button small variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
              {image ? "Schimbă imaginea" : "Alege imagine"}
            </Button>
            {image && (
              <span className="flex items-center gap-2 text-sm text-slate-600">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(image)} alt="" className="h-10 w-10 rounded-lg object-cover" />
                <span className="max-w-[12rem] truncate">{image.name}</span>
                <button type="button" onClick={clearImage} className="text-red-600 underline">elimină</button>
              </span>
            )}
          </div>
        </div>

        <Button onClick={create} disabled={busy}>{busy ? "Se publică…" : "Publică noutatea"}</Button>
      </Card>

      {posts === null ? <Spinner /> : posts.length === 0 ? (
        <EmptyState title="Nicio noutate publicată" hint="Prima noutate apare pe pagina principală și în panoul clienților." />
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <Card key={p.id} className="flex items-start justify-between gap-4 p-5">
              <div className="flex min-w-0 items-start gap-3">
                {p.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                )}
                <div className="min-w-0">
                  <p className="font-display font-bold text-brand-800">{p.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{p.body}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(p.posted_at + "Z").toLocaleString("ro-RO")}
                    {p.tg_url && <> · <a className="text-brand-600 underline" href={p.tg_url} target="_blank" rel="noreferrer">Telegram</a></>}
                  </p>
                </div>
              </div>
              <Button small variant="ghost" onClick={() => setConfirmDelete(p)}><span className="text-red-600">Șterge</span></Button>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!confirmDelete} title="Ștergi noutatea?" onClose={() => setConfirmDelete(null)}>
        <p className="text-sm text-slate-600">„{confirmDelete?.title}” va dispărea de pe site. Acțiunea nu poate fi anulată.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Renunță</Button>
          <Button variant="danger" onClick={() => confirmDelete && remove(confirmDelete)}>Șterge</Button>
        </div>
      </Modal>
    </div>
  );
}
