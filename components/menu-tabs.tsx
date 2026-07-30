import Link from "next/link";

/** Segmented pill nav: view today's menu vs. go to the ordering page (which
 *  covers both the daily menu and the "Bucate la comandă" catalogue). */
export function MenuTabs({ active }: { active: "zilei" | "comanda" }) {
  const tabs = [
    { key: "zilei", label: "Meniul zilei", href: "/menu" },
    { key: "comanda", label: "Comandă acum", href: "/order" },
  ] as const;
  return (
    <div className="flex rounded-full bg-brand-50 p-1 text-sm font-semibold">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Link key={t.key} href={t.href}
            aria-current={on ? "page" : undefined}
            className={`flex-1 rounded-full px-4 py-2 text-center transition ${on ? "bg-brand-500 text-white shadow-sm" : "text-brand-700 hover:text-brand-900"}`}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
