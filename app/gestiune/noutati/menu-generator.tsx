"use client";
import { useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { useToast } from "@/components/providers";

type GenResult = {
  image: string; pdf: string; imageUrl: string; pdfUrl: string;
  meta: { label: string; weekday: string | null; date: string | null };
  caption: string; itemCount: number; warnings: string[];
  telegram?: { posted: boolean; error?: string };
};

export function MenuGenerator() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [includePdf, setIncludePdf] = useState(false);
  const [busy, setBusy] = useState<"" | "gen" | "genpost" | "post">("");
  const [result, setResult] = useState<GenResult | null>(null);
  const [posted, setPosted] = useState(false);
  const [error, setError] = useState("");

  function pick(f: File | null) {
    setFile(f); setResult(null); setPosted(false); setError("");
  }

  async function generate(post: boolean) {
    if (!file) { toast.push("Alegeți un fișier .xlsx.", "error"); return; }
    setBusy(post ? "genpost" : "gen"); setError(""); setResult(null); setPosted(false);
    const fd = new FormData();
    fd.append("file", file);
    if (post) fd.append("post", "1");
    if (includePdf) fd.append("includePdf", "1");
    try {
      const res = await fetch("/api/admin/menu/generate", { method: "POST", body: fd });
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

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-display text-lg font-bold text-brand-800">Generează meniu din Excel</h2>
        <p className="mt-1 text-sm text-slate-600">
          Încarcă fișierul Excel al zilei (.xlsx). Sistemul creează automat o imagine PNG și un PDF
          cu aspectul brandului Ma&rsquo;Maria, apoi le poți posta pe Telegram.
        </p>
      </div>

      {/* upload */}
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

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={includePdf} onChange={(e) => setIncludePdf(e.target.checked)}
          className="h-4 w-4 rounded border-brand-300 text-brand-600 focus:ring-brand-200" />
        Trimite și PDF-ul ca document pe Telegram
      </label>

      {/* actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => generate(false)} disabled={!file || working}>
          {busy === "gen" ? "Se generează…" : "Generează meniu"}
        </Button>
        <Button variant="outline" onClick={() => generate(true)} disabled={!file || working}>
          {busy === "genpost" ? "Se generează și postează…" : "Generează și postează pe Telegram"}
        </Button>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{error}</p>}

      {/* result preview */}
      {result && (
        <div className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-brand-800">
              {result.meta.label || "Meniu"} · {result.itemCount} produse
              {posted && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">Postat ✓</span>}
            </p>
            <div className="flex gap-3 text-sm">
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

          {!posted && (
            <Button small onClick={postToTelegram} disabled={working}>
              {busy === "post" ? "Se postează…" : "Postează pe Telegram"}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
