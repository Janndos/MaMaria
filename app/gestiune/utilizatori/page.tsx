"use client";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Input, Modal, Spinner } from "@/components/ui";
import { useToast } from "@/components/providers";

type U = { id: number; full_name: string; phone: string; role: string; phone_verified: number; created_at: string };

export default function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<U[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<U | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resetting, setResetting] = useState<U | null>(null);
  const [newPass, setNewPass] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewerRole, setViewerRole] = useState<string>("");

  const load = useCallback(() => {
    fetch("/api/admin/users").then((r) => r.json()).then((d) => { setUsers(d.users ?? []); setViewerRole(d.viewerRole ?? ""); });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function changeRole(u: U, role: "customer" | "tehno") {
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }),
    });
    if (!res.ok) { toast.push((await res.json()).error || "Eroare.", "error"); return; }
    toast.push(role === "tehno" ? `„${u.full_name}" este acum operator tehno.` : `„${u.full_name}" este acum client.`);
    load();
  }

  async function resetPassword() {
    if (!resetting) return;
    if (newPass.length < 8) { toast.push("Parola trebuie să aibă minim 8 caractere.", "error"); return; }
    setSaving(true);
    const res = await fetch(`/api/admin/users/${resetting.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: newPass }),
    });
    setSaving(false);
    if (!res.ok) { toast.push((await res.json()).error || "Eroare la resetare.", "error"); return; }
    toast.push(`Parola pentru „${resetting.full_name}" a fost schimbată.`);
    setResetting(null); setNewPass("");
  }

  async function deleteUser(u: U) {
    setDeleting(true);
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) { toast.push((await res.json()).error || "Eroare la ștergere.", "error"); return; }
    toast.push(`Utilizatorul „${u.full_name}" a fost șters.`);
    setConfirmDelete(null);
    load();
  }

  if (!users) return <Spinner label="Se încarcă utilizatorii..." />;
  return (
    <>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="bg-brand-50 text-left text-xs font-bold uppercase tracking-wide text-brand-700">
              <th className="px-4 py-2.5">Nume</th>
              <th className="px-4 py-2.5">Telefon</th>
              <th className="px-4 py-2.5">Rol</th>
              <th className="px-4 py-2.5">Verificat</th>
              <th className="px-4 py-2.5">Înregistrat</th>
              <th className="px-4 py-2.5 text-right">Acțiuni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2.5 font-medium">{u.full_name}</td>
                <td className="px-4 py-2.5 tabular-nums">{u.phone}</td>
                <td className="px-4 py-2.5">
                  {u.role === "admin" ? <Badge tone="gold">Admin</Badge>
                    : u.role === "tehno" ? <Badge tone="green">Tehno</Badge>
                    : <Badge tone="gray">Client</Badge>}
                </td>
                <td className="px-4 py-2.5">{u.phone_verified ? <Badge tone="green">Da</Badge> : <Badge tone="red">Nu</Badge>}</td>
                <td className="px-4 py-2.5 text-slate-500">{new Date(u.created_at + "Z").toLocaleDateString("ro-RO")}</td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap justify-end gap-2">
                    {/* Only an admin may change roles, and never for another admin. */}
                    {viewerRole === "admin" && u.role === "customer" && (
                      <button onClick={() => changeRole(u, "tehno")}
                        className="rounded-full border border-brand-300 px-3 py-1 text-xs font-bold text-brand-700 hover:bg-brand-50">
                        Fă operator tehno
                      </button>
                    )}
                    {viewerRole === "admin" && u.role === "tehno" && (
                      <button onClick={() => changeRole(u, "customer")}
                        className="rounded-full border border-brand-300 px-3 py-1 text-xs font-bold text-brand-700 hover:bg-brand-50">
                        Revoacă (fă client)
                      </button>
                    )}
                    <button onClick={() => { setResetting(u); setNewPass(""); }}
                      className="rounded-full border border-brand-200 px-3 py-1 text-xs font-bold text-brand-700 hover:bg-brand-50">
                      Resetează parola
                    </button>
                    {u.role !== "admin" && (
                      <button onClick={() => setConfirmDelete(u)}
                        className="rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50">
                        Șterge
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={!!resetting} title="Resetează parola" onClose={() => !saving && setResetting(null)}>
        <p className="text-sm text-slate-600">
          Setați o parolă nouă pentru „{resetting?.full_name}" ({resetting?.phone}) și comunicați-i-o.
          Parola veche nu poate fi recuperată (este stocată criptat).
        </p>
        <Input className="mt-3" value={newPass} onChange={(e) => setNewPass(e.target.value)}
          placeholder="Parolă nouă (min. 8 caractere)" autoFocus />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setResetting(null)} disabled={saving}>Renunță</Button>
          <Button onClick={resetPassword} disabled={saving || newPass.length < 8}>
            {saving ? "Se salvează..." : "Salvează parola"}
          </Button>
        </div>
      </Modal>

      <Modal open={!!confirmDelete} title="Ștergi utilizatorul?" onClose={() => !deleting && setConfirmDelete(null)}>
        <p className="text-sm text-slate-600">
          „{confirmDelete?.full_name}" ({confirmDelete?.phone}) va fi șters definitiv, împreună cu comenzile sale.
          Acțiunea nu poate fi anulată.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)} disabled={deleting}>Renunță</Button>
          <Button variant="danger" onClick={() => confirmDelete && deleteUser(confirmDelete)} disabled={deleting}>
            {deleting ? "Se șterge..." : "Șterge"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
