"use client";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Modal, Spinner } from "@/components/ui";
import { useToast } from "@/components/providers";

type U = { id: number; full_name: string; phone: string; role: string; phone_verified: number; created_at: string };

export default function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<U[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<U | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    fetch("/api/admin/users").then((r) => r.json()).then((d) => setUsers(d.users ?? []));
  }, []);
  useEffect(() => { load(); }, [load]);

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
                <td className="px-4 py-2.5">{u.role === "admin" ? <Badge tone="gold">Admin</Badge> : <Badge tone="gray">Client</Badge>}</td>
                <td className="px-4 py-2.5">{u.phone_verified ? <Badge tone="green">Da</Badge> : <Badge tone="red">Nu</Badge>}</td>
                <td className="px-4 py-2.5 text-slate-500">{new Date(u.created_at + "Z").toLocaleDateString("ro-RO")}</td>
                <td className="px-4 py-2.5 text-right">
                  {u.role === "admin" ? (
                    <span className="text-xs text-slate-400">—</span>
                  ) : (
                    <button onClick={() => setConfirmDelete(u)}
                      className="rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50">
                      Șterge
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

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
