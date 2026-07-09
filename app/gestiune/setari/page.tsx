import { getSetting } from "@/lib/db";
import { CutoffForm } from "../cutoff-form";
import { OrdersToggle } from "../orders-toggle";
import { TelegramForm } from "./telegram-form";

export const dynamic = "force-dynamic";

export default function AdminSettingsPage() {
  const cutoff = getSetting("order_cutoff", "10:30");
  const ordersEnabled = getSetting("orders_enabled", "true") === "true";
  const telegramUrl = getSetting("telegram_url", "https://t.me/mamaria_md");

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-black text-brand-800">Setări</h1>

      <section className="rounded-card bg-white p-5 shadow-card">
        <h2 className="font-display text-lg font-bold text-brand-800">Preluarea comenzilor</h2>
        <p className="mt-1 text-sm text-slate-600">
          Când comenzile sunt oprite, clienții văd meniul în continuare, dar nu pot plasa comenzi
          — nici din interfață, nici direct prin API.
        </p>
        <div className="mt-3"><OrdersToggle initial={ordersEnabled} /></div>
      </section>

      <section className="rounded-card bg-white p-5 shadow-card">
        <h2 className="font-display text-lg font-bold text-brand-800">Ora limită zilnică</h2>
        <p className="mt-1 text-sm text-slate-600">După această oră, comenzile pentru ziua curentă se închid automat.</p>
        <CutoffForm initial={cutoff} />
      </section>

      <section className="rounded-card bg-white p-5 shadow-card">
        <h2 className="font-display text-lg font-bold text-brand-800">Canalul Telegram</h2>
        <p className="mt-1 text-sm text-slate-600">Linkul deschis de butonul „Deschide Telegram" de pe pagina Noutăți.</p>
        <TelegramForm initial={telegramUrl} />
      </section>
    </div>
  );
}
