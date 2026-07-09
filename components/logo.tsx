/** Official Ma'Maria logo (public/logo.jpg) — the full lockup (mark + wordmark +
 *  "CAFE & CATERING"). Sized by height via `className`; width stays auto so it is
 *  never distorted. `boxed` puts it on a white pad for dark backgrounds. */
export function Logo({ className = "h-10", boxed = false }: { className?: string; boxed?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src="/logo.png" alt="Ma'Maria" className={`${className} w-auto object-contain`} />;
  if (boxed) return <span className="inline-flex rounded-xl bg-white p-2">{img}</span>;
  return img;
}

export function Logo_M({ className = "h-10", boxed = false }: { className?: string; boxed?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src="/logo_M.png" alt="Ma'Maria" className={`${className} w-auto object-contain`} />;
  if (boxed) return <span className="inline-flex rounded-xl bg-white p-2">{img}</span>;
  return img;
}
