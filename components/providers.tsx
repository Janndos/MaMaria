"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";

/* ---------- Cart ---------- */
export type CartSource = "daily" | "stable";
export type CartLine = {
  key: string;            // stable composite id: `${source}:${itemId}`
  source: CartSource;
  itemId: number;
  name: string;
  grams: number | null;
  unit?: string | null;
  price: number;
  qty: number;
};

/** Build the composite key that keeps daily & stable items (separate tables,
 *  overlapping numeric ids) from clobbering each other in the cart. */
export function cartKey(source: CartSource, itemId: number) { return `${source}:${itemId}`; }

type CartCtx = {
  lines: CartLine[];
  add: (line: Omit<CartLine, "qty" | "key">, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  /** Bind the cart to a menu date; drops stale DAILY items (and returns true) if
   *  they came from another day. Stable items are date-independent and kept. */
  syncDate: (menuDate: string) => boolean;
  total: number;
  count: number;
};
const CartContext = createContext<CartCtx | null>(null);
const CART_KEY = "mamaria_cart_v3"; // {date, lines[]} — v3 adds source/composite key

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart outside provider");
  return ctx;
}

/* ---------- Toasts ---------- */
type Toast = { id: number; text: string; tone: "success" | "error" };
type ToastCtx = { push: (text: string, tone?: "success" | "error") => void };
const ToastContext = createContext<ToastCtx | null>(null);
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast outside provider");
  return ctx;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [cartDate, setCartDate] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const cartDateRef = useRef<string | null>(null);
  const linesRef = useRef<CartLine[]>([]);
  useEffect(() => { cartDateRef.current = cartDate; }, [cartDate]);
  useEffect(() => { linesRef.current = lines; }, [lines]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const rawLines: any[] = Array.isArray(parsed) ? parsed : parsed.lines ?? [];
        // Keep only well-formed v3 lines (drops any legacy shape without a key).
        setLines(rawLines.filter((l) => l && typeof l.key === "string" && l.source));
        if (!Array.isArray(parsed) && parsed.date) setCartDate(parsed.date);
      }
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(CART_KEY, JSON.stringify({ date: cartDate, lines }));
  }, [lines, cartDate, loaded]);

  const add = useCallback((line: Omit<CartLine, "qty" | "key">, qty = 1) => {
    const key = cartKey(line.source, line.itemId);
    setLines((prev) => {
      const ex = prev.find((l) => l.key === key);
      if (ex) return prev.map((l) => (l.key === key ? { ...l, qty: Math.min(20, l.qty + qty) } : l));
      return [...prev, { ...line, key, qty }];
    });
  }, []);
  const setQty = useCallback((key: string, qty: number) => {
    setLines((prev) => (qty <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, qty: Math.min(20, qty) } : l))));
  }, []);
  const remove = useCallback((key: string) => setLines((prev) => prev.filter((l) => l.key !== key)), []);
  const clear = useCallback(() => setLines([]), []);
  const syncDate = useCallback((menuDate: string) => {
    const changed = cartDateRef.current !== null && cartDateRef.current !== menuDate;
    const stale = changed && linesRef.current.some((l) => l.source === "daily");
    // Drop only stale daily items; stable items are date-independent and survive.
    if (changed) setLines((prev) => prev.filter((l) => l.source !== "daily"));
    setCartDate(menuDate);
    return stale;
  }, []);
  const total = useMemo(() => lines.reduce((s, l) => s + l.price * l.qty, 0), [lines]);
  const count = useMemo(() => lines.reduce((s, l) => s + l.qty, 0), [lines]);

  const push = useCallback((text: string, tone: "success" | "error" = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      <CartContext.Provider value={{ lines, add, setQty, remove, clear, syncDate, total, count }}>
        {children}
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
          {toasts.map((t) => (
            <div key={t.id}
              className={`pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${t.tone === "success" ? "bg-brand-600" : "bg-red-600"}`}>
              {t.text}
            </div>
          ))}
        </div>
      </CartContext.Provider>
    </ToastContext.Provider>
  );
}
