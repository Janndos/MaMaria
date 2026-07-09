import Link from "next/link";
import { getMenuByDate, todayISO } from "@/lib/db";
import { Logo } from "@/components/logo";

export default function LandingPage() {
  const menu = getMenuByDate(todayISO());
  const hasMenu = !!menu?.published;
  return (
    <div className="flex min-h-[70dvh] flex-col justify-center gap-8 py-6 text-center">
      <div className="flex flex-col items-center">
        <Logo className="h-32 sm:h-40" />
        <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-gold-400" />
      </div>

      <p className="mx-auto max-w-[30ch] text-[17px] leading-relaxed text-slate-600">
        Ma&rsquo;Maria gătește zilnic bucate calde, gustoase și simple, ca acasă.
        Verifică meniul de azi și comandă rapid de pe telefon.
      </p>

      <div className="space-y-3">
        <Link href="/menu"
          className="block w-full rounded-2xl bg-brand-500 px-6 py-4 text-lg font-bold text-white shadow-card transition hover:bg-brand-600 active:scale-[0.98]">
          Vezi meniul de azi
        </Link>
        {!hasMenu && (
          <p className="text-sm text-slate-400">Meniul de azi nu este publicat încă — revino în curând.</p>
        )}
        <Link href="/noutati" className="block text-sm font-semibold text-brand-600 underline underline-offset-4">
          Fii la curent cu noutățile →
        </Link>
      </div>

      <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-2 text-center text-[11px] font-semibold text-slate-500">
        <div className="rounded-xl bg-white p-3 shadow-sm"><span className="block text-lg">🍲</span>Gătit zilnic</div>
        <div className="rounded-xl bg-white p-3 shadow-sm"><span className="block text-lg">📱</span>Comanzi online</div>
        <div className="rounded-xl bg-white p-3 shadow-sm"><span className="block text-lg">🛍️</span>Ridici la tejghea</div>
      </div>
    </div>
  );
}
