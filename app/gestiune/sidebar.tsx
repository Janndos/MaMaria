"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/logo";

const NAV = [
  { href: "/gestiune", label: "Prezentare", icon: "M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z" },
  { href: "/gestiune/incarca", label: "Încarcă meniul", icon: "M12 16V4m0 0 4 4m-4-4-4 4M4 20h16" },
  { href: "/gestiune/meniu", label: "Meniul zilei", icon: "M3 5h18M3 12h18M3 19h12" },
  { href: "/gestiune/produse-permanente", label: "Produse permanente", icon: "M20 7 12 3 4 7m16 0-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { href: "/gestiune/comenzi", label: "Comenzi", icon: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
  { href: "/gestiune/noutati", label: "Noutăți", icon: "M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0V9M18 14h-8M15 18h-5M10 6h8v4h-8V6Z" },
  { href: "/gestiune/utilizatori", label: "Utilizatori", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { href: "/gestiune/setari", label: "Setări", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" },
];

export function AdminSidebar({ adminName }: { adminName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <aside className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col border-r border-brand-100 bg-brand-800 text-brand-100">
      <div className="border-b border-brand-700 px-5 py-5">
        <Logo className="h-12" boxed />
        <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-gold-400">Panou admin</p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV.map((n) => {
          const active = n.href === "/gestiune" ? pathname === "/gestiune" : pathname.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${active ? "bg-brand-600 text-white" : "hover:bg-brand-700 hover:text-white"}`}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-80">
                <path d={n.icon} />
              </svg>
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-brand-700 p-3 text-sm">
        <p className="truncate px-3.5 pb-2 text-xs text-brand-300">{adminName}</p>
        <Link href="/" className="block rounded-xl px-3.5 py-2 font-semibold hover:bg-brand-700 hover:text-white">← Vezi site-ul</Link>
        <button onClick={logout} className="block w-full rounded-xl px-3.5 py-2 text-left font-semibold text-red-300 hover:bg-brand-700">Ieșire</button>
      </div>
    </aside>
  );
}
