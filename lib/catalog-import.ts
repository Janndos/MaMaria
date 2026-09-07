import { fold } from "./search";
import type { CatalogRow } from "./parse-catalog";

/* ============================================================================
 *  Comparing an uploaded catalogue export against the price list already stored.
 *
 *  The admin re-uploads the SAME export with a few extra rows, so the import has
 *  to be idempotent: re-importing an unchanged file must add nothing. Rows are
 *  therefore matched on name+price, and only what is genuinely missing is added.
 *
 *  Nothing is ever deleted — products added by hand in the Catalog screen do not
 *  appear in the kitchen export and must survive an import untouched.
 * ========================================================================== */

export type DbProduct = { id: number; name: string; price: number };

export type ImportPlan = {
  /** Rows to insert. */
  add: CatalogRow[];
  /** Single, unambiguous price changes the admin may opt into. */
  update: { id: number; name: string; from: number; to: number }[];
  /** File rows already present with the same price. */
  unchanged: number;
  /** Same name on both sides but too many candidates to match safely. */
  ambiguous: { name: string; filePrices: number[]; dbPrices: number[] }[];
  /** Catalogue entries absent from the file — reported only, never deleted. */
  onlyInCatalog: number;
};

/** Identity for matching. Case, diacritics and stray inner spacing vary between
 *  exports, and treating "CHEC DE CIOCOLATA" as a new product would duplicate the
 *  whole catalogue, so those differences are folded away. */
export function catalogKey(name: string): string {
  return fold(name).replace(/\s+/g, " ");
}

/** Work out what an uploaded file would change, without touching anything. */
export function planImport(fileRows: CatalogRow[], dbRows: DbProduct[]): ImportPlan {
  const byKey = new Map<string, DbProduct[]>();
  for (const d of dbRows) {
    const k = catalogKey(d.name);
    const list = byKey.get(k);
    if (list) list.push(d); else byKey.set(k, [d]);
  }

  const usedDbIds = new Set<number>();
  const leftover: CatalogRow[] = [];
  let unchanged = 0;

  // Pass 1 — exact name+price matches. Each database row can only be claimed
  // once, so a name listed twice (e.g. "Snitel Vienez MM" at 75 and 200) lines
  // its two prices up with its two stored rows instead of matching both to one.
  for (const f of fileRows) {
    const candidates = byKey.get(catalogKey(f.name)) ?? [];
    const hit = candidates.find((d) => !usedDbIds.has(d.id) && d.price === f.price);
    if (hit) { usedDbIds.add(hit.id); unchanged++; }
    else leftover.push(f);
  }

  // Pass 2 — whatever is left is either new, a price change, or ambiguous.
  const add: CatalogRow[] = [];
  const update: ImportPlan["update"] = [];
  const ambiguous: ImportPlan["ambiguous"] = [];

  const byKeyLeftover = new Map<string, CatalogRow[]>();
  for (const f of leftover) {
    const k = catalogKey(f.name);
    const list = byKeyLeftover.get(k);
    if (list) list.push(f); else byKeyLeftover.set(k, [f]);
  }

  // Array.from keeps this compatible with the project's ES5 downlevel target.
  for (const [key, files] of Array.from(byKeyLeftover.entries())) {
    const free = (byKey.get(key) ?? []).filter((d) => !usedDbIds.has(d.id));
    if (free.length === 0) {
      add.push(...files);                       // name not in the catalogue at all
    } else if (free.length === 1 && files.length === 1) {
      update.push({ id: free[0].id, name: free[0].name, from: free[0].price, to: files[0].price });
    } else {
      // Several same-named rows on one or both sides: which price replaces which
      // is a guess, so leave them for the admin rather than corrupting the list.
      ambiguous.push({
        name: files[0].name,
        filePrices: files.map((f: CatalogRow) => f.price),
        dbPrices: free.map((d) => d.price),
      });
    }
  }

  return { add, update, unchanged, ambiguous, onlyInCatalog: dbRows.length - usedDbIds.size };
}
