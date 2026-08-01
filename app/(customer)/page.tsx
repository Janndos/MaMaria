import Link from "next/link";
import { getMenuByDate, todayISO } from "@/lib/db";
import { Logo } from "@/components/logo";
import cooking from "../cooking.png";
import order from "../order.png";
import pickup from "../pickup.png";

const FEATURES = [
  { img: cooking, title: "Gătit zilnic", hint: "Bucate calde, proaspete în fiecare zi." },
  { img: order, title: "Comanzi online", hint: "Alegi din meniu și trimiți comanda rapid." },
  { img: pickup, title: "Ridici la tejghea", hint: "Plata numerar sau card, la ridicare." },
];

export default function LandingPage() {
  const menu = getMenuByDate(todayISO());
  const hasMenu = !!menu?.published;

  return (
    <div className="py-6 lg:py-14">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Hero */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <Logo className="h-32 sm:h-40" />
          <div className="mt-4 h-1 w-16 rounded-full bg-gold-400" />

          <p className="mx-auto mt-6 max-w-[32ch] text-[17px] leading-relaxed text-slate-600 lg:mx-0 lg:text-lg">
            Ma&rsquo;Maria gătește zilnic bucate calde, gustoase și simple, ca acasă.
            Verifică meniul de azi și comandă rapid.
          </p>

          <div className="mt-8 w-full max-w-sm space-y-3 lg:max-w-md">
            <Link href="/meniu"
              className="block w-full rounded-2xl bg-brand-500 px-6 py-4 text-lg font-bold text-white shadow-card transition hover:bg-brand-600 active:scale-[0.98]">
              Vezi meniul de azi
            </Link>
            {!hasMenu && (
              <p className="text-sm text-slate-400">Meniul de azi nu este publicat încă — revino în curând.</p>
            )}
            <Link href="/noutati"
              className="block text-sm font-semibold text-brand-600 underline underline-offset-4 lg:inline-block">
              Fii la curent cu noutățile →
            </Link>
          </div>
        </div>

        {/* Feature highlights: compact tiles on mobile, a card stack on desktop */}
        <div className="grid grid-cols-3 gap-2 text-center lg:grid-cols-1 lg:gap-3 lg:text-left">
          {FEATURES.map((f) => (
            <div key={f.title}
              className="flex flex-col items-center rounded-xl bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:gap-4 lg:rounded-2xl lg:p-5 lg:shadow-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.img.src} alt="" aria-hidden
                className="h-7 w-7 shrink-0 object-contain lg:h-11 lg:w-11" />
              <span className="mt-1 text-[11px] font-semibold text-slate-600 lg:mt-0">
                <span className="lg:block lg:text-base lg:font-bold lg:text-brand-800">{f.title}</span>
                <span className="hidden text-sm font-normal text-slate-500 lg:block">{f.hint}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
