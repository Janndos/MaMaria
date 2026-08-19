"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { useToast } from "@/components/providers";

/** Where the sheet is generated from: an uploaded Excel file, or a menu already
 *  saved in the panel (built by hand in "Încarcă meniul"). */
type Source = "xlsx" | "saved";
type SavedMenu = { id: number; date: string; title: string; published: number };

function roDate(iso: string) {
  const s = new Date(`${iso}T12:00:00`).toLocaleDateString("ro-RO", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type ParseDebug = {
  sheet: string | null;
  headerRow: number | null;
  columns: { num: number; category: number; name: number; grams: number; price: number };
  categories: number;
  products: number;
  warnings: string[];
  weekday?: string | null;
  date?: string | null;
  svgLength?: number;
  fontsFound?: boolean;
};
type GenResult = {
  image: string; pdf: string; imageUrl: string; pdfUrl: string;
  meta: { label: string; weekday: string | null; date: string | null };
  caption: string; itemCount: number; warnings: string[];
  debug?: ParseDebug;
  telegram?: { posted: boolean; error?: string };
};

export function MenuGenerator() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source>("xlsx");
  const [file, setFile] = useState<File | null>(null);
  const [menus, setMenus] = useState<SavedMenu[] | null>(null);
  const [menuDate, setMenuDate] = useState("");
  const [includePdf, setIncludePdf] = useState(false);
  const [busy, setBusy] = useState<"" | "gen" | "genpost" | "post">("");
  const [result, setResult] = useState<GenResult | null>(null);
  const [posted, setPosted] = useState(false);
  const [error, setError] = useState("");
  const [debug, setDebug] = useState<ParseDebug | null>(null);

  const reset = useCallback(() => {
    setResult(null); setPosted(false); setError(""); setDebug(null);
  }, []);

  function pick(f: File | null) {
    setFile(f); reset();
  }

  // Load the saved menus the first time that source is selected.
  const loadMenus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/menus");
      const list: SavedMenu[] = (await res.json()).menus ?? [];
      setMenus(list);
      setMenuDate((prev) => prev || list[0]?.date || "");
    } catch {
      setMenus([]);
    }
  }, []);
  useEffect(() => {
    if (source === "saved" && menus === null) loadMenus();
  }, [source, menus, loadMenus]);

  function switchSource(s: Source) {
    setSource(s);
    reset();
  }

  async function generate(post: boolean) {
    if (source === "saved") return generateFromSaved(post);
    if (!file) { toast.push("Alegeți un fișier .xlsx.", "error"); return; }
    setBusy(post ? "genpost" : "gen"); reset();
    const fd = new FormData();
    fd.append("file", file);
    if (post) fd.append("post", "1");
    if (includePdf) fd.append("includePdf", "1");
    try {
      const res = await fetch("/api/admin/menu/generate", { method: "POST", body: fd });
      const data = await res.json();
      if (data?.debug) setDebug(data.debug as ParseDebug);
      if (!res.ok) { setError(data.error || "Generare eșuată."); toast.push(data.error || "Generare eșuată.", "error"); return; }
      setResult(data);
      toast.push(`Meniu generat (${data.itemCount} produse).`);
      if (post) {
        if (data.telegram?.posted) { setPosted(true); toast.push("Postat pe Telegram."); }
        else { toast.push(data.telegram?.error || "Postarea pe Telegram a eșuat.", "error"); setError(data.telegram?.error || ""); }
      }
    } catch {
      setError("Eroare de rețea."); toast.push("Eroare de rețea.", "error");
    } finally { setBusy(""); }
  }

  /** Same endpoint, JSON body — renders a menu already stored in the panel. */
  async function generateFromSaved(post: boolean) {
    if (!menuDate) { toast.push("Alegeți un meniu salvat.", "error"); return; }
    setBusy(post ? "genpost" : "gen"); reset();
    try {
      const res = await fetch("/api/admin/menu/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: menuDate, post, includePdf }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Generare eșuată."); toast.push(data.error || "Generare eșuată.", "error"); return; }
      setResult(data);
      toast.push(`Meniu generat (${data.itemCount} produse).`);
      if (post) {
        if (data.telegram?.posted) { setPosted(true); toast.push("Postat pe Telegram."); }
        else { toast.push(data.telegram?.error || "Postarea pe Telegram a eșuat.", "error"); setError(data.telegram?.error || ""); }
      }
    } catch {
      setError("Eroare de rețea."); toast.push("Eroare de rețea.", "error");
    } finally { setBusy(""); }
  }

  async function postToTelegram() {
    if (!result) return;
    setBusy("post"); setError("");
    try {
      const res = await fetch("/api/admin/menu/telegram", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: result.image, pdf: result.pdf, caption: result.caption, includePdf }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Postare eșuată."); toast.push(data.error || "Postare eșuată.", "error"); return; }
      setPosted(true); toast.push("Postat pe Telegram.");
    } catch {
      setError("Eroare de rețea."); toast.push("Eroare de rețea.", "error");
    } finally { setBusy(""); }
  }

  const working = busy !== "";
  const ready = source === "xlsx" ? !!file : !!menuDate;

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-display text-lg font-bold text-brand-800">Generează meniul (imagine + PDF)</h2>
        <p className="mt-1 text-sm text-slate-600">
          Sistemul creează o imagine PNG și un PDF format A4 cu aspectul brandului Ma&rsquo;Maria,
          gata de printat și de postat pe Telegram. Sursa poate fi fișierul Excel al zilei sau un
          meniu pe care l-ai construit singur în <span className="font-semibold">Încarcă meniul</span>.
        </p>
      </div>

      {/* source switch */}
      <div role="tablist" aria-label="Sursa meniului" className="flex flex-wrap gap-2">
        <button role="tab" aria-selected={source === "xlsx"} onClick={() => switchSource("xlsx")}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${source === "xlsx" ? "bg-brand-500 text-white" : "border border-brand-200 text-brand-700 hover:bg-brand-50"}`}>
          Din fișier Excel
        </button>
        <button role="tab" aria-selected={source === "saved"} onClick={() => switchSource("saved")}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${source === "saved" ? "bg-brand-500 text-white" : "border border-brand-200 text-brand-700 hover:bg-brand-50"}`}>
          Din meniul salvat
        </button>
      </div>

      {source === "xlsx" ? (
        /* upload */
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          <Button small variant="outline" onClick={() => fileRef.current?.click()} disabled={working}>
            {file ? "Schimbă fișierul" : "Alege fișier .xlsx"}
          </Button>
          {file && (
            <span className="text-sm text-slate-600">
              📄 {file.name} <span className="text-slate-400">({Math.ceil(file.size / 1024)} KB)</span>
            </span>
          )}
        </div>
      ) : (
        /* saved-menu picker */
        <div className="space-y-2">
          {menus === null ? (
            <p className="text-sm text-slate-500">Se încarcă meniurile salvate…</p>
          ) : menus.length === 0 ? (
            <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800">
              Niciun meniu salvat încă. Creează unul în „Încarcă meniul" → „Creează-l singur!".
            </p>
          ) : (
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-brand-800">Meniul salvat</span>
              <select value={menuDate} onChange={(e) => { setMenuDate(e.target.value); reset(); }}
                className="w-full max-w-md rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100">
                {menus.map((m) => (
                  <option key={m.id} value={m.date}>
                    {roDate(m.date)} — {m.title}{m.published ? "" : " (ciornă)"}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={includePdf} onChange={(e) => setIncludePdf(e.target.checked)}
          className="h-4 w-4 rounded border-brand-300 text-brand-600 focus:ring-brand-200" />
        Trimite și PDF-ul ca document pe Telegram
      </label>

      {/* actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => generate(false)} disabled={!ready || working}>
          {busy === "gen" ? "Se generează…" : "Generează meniu"}
        </Button>
        <Button variant="outline" onClick={() => generate(true)} disabled={!ready || working}>
          {busy === "genpost" ? "Se generează și postează…" : "Generează și postează pe Telegram"}
        </Button>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{error}</p>}

      {/* parse diagnostics — shown after every upload, success or failure */}
      {debug && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <p className="font-semibold text-slate-700">Diagnostic parsare</p>
          <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-3">
            <li>Foaie: <span className="font-mono">{debug.sheet ?? "—"}</span></li>
            <li>Rând antet: <span className="font-mono">{debug.headerRow ?? "negăsit"}</span></li>
            <li>Categorii: <span className="font-mono">{debug.categories}</span></li>
            <li className={debug.products === 0 ? "font-semibold text-red-600" : ""}>
              Produse: <span className="font-mono">{debug.products}</span>
            </li>
            {debug.fontsFound !== undefined && (
              <li className={debug.fontsFound ? "" : "font-semibold text-red-600"}>
                Fonturi: <span className="font-mono">{debug.fontsFound ? "găsite" : "LIPSĂ"}</span>
              </li>
            )}
            {debug.svgLength !== undefined && <li>SVG: <span className="font-mono">{debug.svgLength}</span></li>}
            <li className="col-span-2 sm:col-span-3">
              Coloane (0-index): № {debug.columns.num}, Denumire {debug.columns.name}, Masa {debug.columns.grams}, Preț {debug.columns.price}
            </li>
          </ul>
          {debug.warnings?.length > 0 && (
            <details className="mt-1 text-amber-800">
              <summary className="cursor-pointer font-semibold">{debug.warnings.length} avertismente</summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {debug.warnings.slice(0, 12).map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* result preview */}
      {result && (
        <div className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-brand-800">
              {result.meta.label || "Meniu"} · {result.itemCount} produse
              {posted && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">Postat ✓</span>}
            </p>
            <div className="flex gap-3 text-sm">
              {/* The PDF is a real single A4 page, so this prints correctly as-is. */}
              <a href={result.pdfUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand-600 underline">🖨 Printează (PDF A4)</a>
              <a href={result.imageUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand-600 underline">Descarcă PNG</a>
              <a href={result.pdfUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand-600 underline">Descarcă PDF</a>
            </div>
          </div>

          {result.warnings?.length > 0 && (
            <details className="text-xs text-amber-800">
              <summary className="cursor-pointer font-semibold">{result.warnings.length} avertismente la parsare</summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {result.warnings.slice(0, 12).map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </details>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.imageUrl} alt="Previzualizare meniu generat"
            className="mx-auto max-h-[520px] w-auto rounded-lg border border-brand-100 shadow-sm" />

          {!posted && result.itemCount > 0 && (
            <Button small onClick={postToTelegram} disabled={working}>
              {busy === "post" ? "Se postează…" : "Postează pe Telegram"}
            </Button>
          )}
          {result.itemCount === 0 && (
            <p className="text-sm font-medium text-red-700">
              Meniul nu conține produse — postarea pe Telegram este dezactivată.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
