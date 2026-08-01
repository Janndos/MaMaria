"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCart } from "./providers";
import { Logo, Logo_M } from "./logo";

type ShellUser = { name: string; role: string } | null;

/** Primary destinations shown in the desktop top nav (and mirrored in the mobile drawer). */
const NAV = [
  { href: "/meniu", label: "Meniu" },
  { href: "/noutati", label: "Noutăți" },
];

/** Responsive customer shell.
 *  - Phone / tablet (< lg): a single app-like column with a top bar (drawer trigger
 *    on the left, cart on the right) and a slide-in navigation drawer.
 *  - Desktop (≥ lg): a full-width horizontal top navigation bar with the content
 *    centered in a comfortable reading column.
 *  The page content ({children}) is rendered exactly once and shared by both. */
export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile drawer on navigation.
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col bg-brand-900/5">
      {/* Chrome: desktop nav (lg+) and mobile top bar (below lg) */}
      <DesktopNav user={user} />
      <MobileTopBar user={user} onMenu={() => setOpen(true)} />

      <main className="mx-auto w-full max-w-[480px] flex-1 px-4 pb-16 pt-5 lg:max-w-4xl lg:px-8 lg:pb-20 lg:pt-10">
        {children}
      </main>

      <footer className="border-t border-brand-100 bg-white px-4 py-5 text-center text-xs text-slate-400">
        © Ma&rsquo;Maria Cafe &amp; Catering
      </footer>

      <Drawer open={open} onClose={() => setOpen(false)} user={user} />
    </div>
  );
}

/** Back-compat alias: the customer layout historically imported `MobileShell`. */
export const MobileShell = AppShell;

/* ------------------------------- desktop nav ------------------------------ */

function DesktopNav({ user }: { user: ShellUser }) {
  const cart = useCart();
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const links = [
    ...NAV,
    ...(user ? [{ href: "/orders", label: "Comenzile mele" }] : []),
    ...(user?.role === "admin" ? [{ href: "/gestiune", label: "Admin" }] : []),
  ];

  return (
    <header className="sticky top-0 z-30 hidden border-b border-brand-100 bg-white/90 backdrop-blur lg:block">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-8 py-3">
        <Link href="/" aria-label="Ma'Maria — pagina principală" className="shrink-0">
          <Logo className="h-11" />
        </Link>

        <nav className="ml-6 flex items-center gap-1">
          {links.map((l) => {
            const on = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  on ? "bg-brand-500 text-white shadow-sm" : "text-brand-700 hover:bg-brand-50"
                }`}>
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Link href="/account"
                className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-50">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-sm font-medium text-white">
                  {user.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="max-w-[10rem] truncate">{user.name.split(" ")[0]}</span>
              </Link>
              <button onClick={logout}
                className="rounded-full px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50">
                Ieșire
              </button>
            </>
          ) : (
            <>
              <Link href="/login"
                className="rounded-full px-4 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50">
                Intră în cont
              </Link>
              <Link href="/register"
                className="rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600">
                Înregistrează-te
              </Link>
            </>
          )}
          <CartButton count={cart.count} />
        </div>
      </div>
    </header>
  );
}

/* ------------------------------- mobile bar ------------------------------- */

function MobileTopBar({ user: _user, onMenu }: { user: ShellUser; onMenu: () => void }) {
  const cart = useCart();
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-brand-100 bg-white/90 px-3 py-2.5 backdrop-blur lg:hidden">
      <button onClick={onMenu} aria-label="Deschide meniul de navigare"
        className="group flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition hover:bg-brand-100 active:scale-95">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M4 7h16" className="transition-transform group-hover:-translate-x-0.5" />
          <path d="M4 12h10" />
          <path d="M4 17h13" />
          <path d="M18.5 10.5 21 13l-2.5 2.5" className="opacity-0 transition-opacity group-hover:opacity-100" />
        </svg>
      </button>
      <Link href="/" className="mx-auto" aria-label="Ma'Maria — pagina principală">
        <Logo_M className="h-10" />
      </Link>
      <CartButton count={cart.count} />
    </header>
  );
}

function CartButton({ count }: { count: number }) {
  return (
    <Link href="/checkout" aria-label="Coșul meu"
      className="relative flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-white transition hover:bg-brand-600 active:scale-95">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 7h12l-1.2 12.1a2 2 0 0 1-2 1.9H9.2a2 2 0 0 1-2-1.9L6 7Z" />
        <path d="M9 7V5a3 3 0 0 1 6 0v2" />
      </svg>
      {count > 0 && (
        <span key={count}
          className="badge-pop absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-500 px-1 text-[11px] font-medium tabular-nums text-white">
          {count}
        </span>
      )}
    </Link>
  );
}

/* --------------------------------- drawer --------------------------------- */

function Drawer({ open, onClose, user }: { open: boolean; onClose: () => void; user: ShellUser }) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    if (open) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    onClose();
    router.push("/");
    router.refresh();
  }

  const item = "flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium text-ink transition hover:bg-brand-50 active:scale-[0.98]";

  return (
    // Fixed to the VIEWPORT so the drawer is always exactly one screen tall and the
    // nav scrolls internally. Only used below lg (the desktop nav replaces it).
    <div className={`fixed inset-0 z-40 lg:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div onClick={onClose}
        className={`absolute inset-0 bg-ink/40 backdrop-blur-[2px] transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} />
      <aside role="dialog" aria-label="Meniu de navigare"
        className={`absolute inset-y-0 left-0 flex h-full w-[82%] max-w-[320px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex shrink-0 items-center justify-between border-b border-brand-100 px-5 py-4">
          <div>
            <Logo_M className="h-9" />
            {user && <p className="mt-1 text-sm text-slate-500">Salut, {user.name.split(" ")[0]}!</p>}
          </div>
          <button onClick={onClose} aria-label="Închide meniul"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-700 hover:bg-brand-100">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {!user && (
            <>
              <Link href="/login" className={item}><Icon d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />Intră în cont</Link>
              <Link href="/register" className={item}><Icon d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6" />Înregistrează-te</Link>
              <div className="my-2 border-t border-brand-100" />
            </>
          )}
          <Link href="/meniu" className={item}><Icon d="M3 5h18M3 12h18M3 19h12" />Meniu</Link>
          <Link href="/noutati" className={item}><Icon d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />Noutăți</Link>
          {user && (
            <>
              <div className="my-2 border-t border-brand-100" />
              <Link href="/account" className={item}><Icon d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />Contul meu</Link>
              <Link href="/orders" className={item}><Icon d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />Comenzile mele</Link>
              {user.role === "admin" && (
                <Link href="/gestiune" className={item}><Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />Admin</Link>
              )}
            </>
          )}
        </nav>
        {user && (
          <div className="shrink-0 border-t border-brand-100 p-3">
            <button onClick={logout} className={`${item} w-full text-red-600 hover:bg-red-50`}>
              <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />Ieșire
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-brand-600">
      <path d={d} />
    </svg>
  );
}
