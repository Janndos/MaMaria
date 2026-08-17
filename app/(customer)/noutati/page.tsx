import db, { getSetting } from "@/lib/db";
import { Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

type Post = {
  id: number; title: string; body: string;
  image_url: string | null; video_url: string | null; tg_url: string | null; posted_at: string;
};

export default function NoutatiPage() {
  const tgUrl = getSetting("telegram_url", "https://t.me/mamaria_md");
  const posts = db.prepare("SELECT * FROM news_posts ORDER BY posted_at DESC LIMIT 10").all() as Post[];
  // Preview bubbles: real posts if we have them, otherwise a friendly mock.
  const bubbles = (posts.length
    ? posts.slice(0, 3).map((p) => ({ title: p.title, body: p.body }))
    : [
        { title: "Meniul zilei 🍲", body: "Meniul de azi e gata! Ciorbă caldă, mămăligă cu unt și plăcinte proaspete." },
        { title: "Catering 🎉", body: "Preluăm comenzi de catering pentru evenimente. Scrieți-ne!" },
        { title: "Program 🕐", body: "Vă așteptăm zilnic între 11:30 și 15:00." },
      ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-black text-brand-800">Fii la curent</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cele mai proaspete noutăți — meniul zilei, oferte și anunțuri — apar pe canalul oficial
          de Telegram al Ma&rsquo;Maria.
        </p>
      </div>

      {/* Telegram-style teaser: glassy, slightly blurred channel preview with a clear CTA on top */}
      <div className="relative overflow-hidden rounded-card shadow-card">
        <div className="bg-[#517DA2] px-4 py-3 text-white">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_M.png" alt="Ma'Maria" width={40} height={40}
              className="h-10 w-10 shrink-0 rounded-full bg-white object-cover" />
            <div className="min-w-0">
              <p className="truncate font-bold leading-tight">Ma&rsquo;Maria Cafe &amp; Catering</p>
              <p className="text-xs text-white/70">canal · Telegram</p>
            </div>
            <svg className="ml-auto shrink-0" width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M21.9 4.6c.3-1.1-.8-2-1.8-1.6L2.7 9.8c-1.2.5-1.1 2.2.1 2.5l4.4 1.2 1.7 5.4c.3 1 1.6 1.3 2.3.5l2.5-2.6 4.5 3.3c.9.6 2.1.2 2.4-.9l1.3-14.6Z" opacity=".9"/>
            </svg>
          </div>
        </div>
        <div className="relative bg-[#E7EBF0] p-4">
          <div className="select-none space-y-3 blur-[3px]" aria-hidden>
            {bubbles.map((b, i) => (
              <div key={i} className="max-w-[85%] rounded-2xl rounded-tl-md bg-white p-3 shadow-sm">
                {b.title && <p className="text-sm font-bold text-[#517DA2]">{b.title}</p>}
                <p className={`line-clamp-2 text-sm text-slate-700 ${b.title ? "mt-0.5" : ""}`}>{b.body}</p>
                <p className="mt-1 text-right text-[10px] text-slate-400">👁 1.2K</p>
              </div>
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-[#E7EBF0]/90 via-transparent to-transparent">
            <a href={tgUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 rounded-full bg-[#517DA2] px-6 py-3.5 font-bold text-white shadow-xl transition hover:bg-[#446a8a] active:scale-95">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M21.9 4.6c.3-1.1-.8-2-1.8-1.6L2.7 9.8c-1.2.5-1.1 2.2.1 2.5l4.4 1.2 1.7 5.4c.3 1 1.6 1.3 2.3.5l2.5-2.6 4.5 3.3c.9.6 2.1.2 2.4-.9l1.3-14.6Z"/>
              </svg>
              Deschide Telegram
            </a>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-display text-lg font-bold text-brand-800">Ultimele noutăți</h2>
        {posts.length === 0 ? (
          <EmptyState title="Nicio noutate încă" hint="Anunțurile Ma'Maria vor apărea aici." />
        ) : (
          <div className="space-y-3">
            {posts.map((p) => (
              <Card key={p.id} className="overflow-hidden p-4">
                {p.video_url && (
                  <video src={p.video_url} controls playsInline preload="metadata"
                    className="mb-3 max-h-72 w-full rounded-lg bg-black object-contain" />
                )}
                {p.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" className="mb-3 max-h-72 w-full rounded-lg object-cover" />
                )}
                {p.title && <p className="font-display font-bold text-brand-800">{p.title}</p>}
                <p className={`text-sm text-slate-600 ${p.title ? "mt-1" : ""}`}>{p.body}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {new Date(p.posted_at + "Z").toLocaleDateString("ro-RO", { day: "numeric", month: "long" })}
                  {p.tg_url && <> · <a className="text-brand-600 underline" href={p.tg_url} target="_blank" rel="noreferrer">vezi pe Telegram</a></>}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
