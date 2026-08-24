/** Forgiving product-name matching, shared by the catalogue picker (Încarcă
 *  meniul) and the Catalog screen so both find things the same way. Pure client-
 *  safe TypeScript — no server imports. */

/** Strip diacritics and case so "Mămăligă" is found by typing "mamaliga". */
export function fold(s: string): string {
  // NFD splits a letter from its accent, and the range below drops the accents.
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** True when every character of `q` appears in `s` in order — forgiving enough to
 *  survive a dropped letter or two ("ciocata" still finds "ciocolata"). */
export function isSubsequence(q: string, s: string): boolean {
  let i = 0;
  for (let j = 0; j < s.length && i < q.length; j++) if (s[j] === q[i]) i++;
  return i === q.length;
}

/**
 * Rank a folded name against a folded query. Lower is better, -1 = no match:
 *   0 name starts with what was typed
 *   1 the typed text appears somewhere in the name
 *   2 every typed word appears, in any order ("chec ciocolata")
 *   3 the letters appear in order, allowing typos ("chec de ciocata")
 */
export function rank(folded: string, q: string, tokens: string[], squashedQ: string): number {
  if (!q) return 0;
  if (folded.startsWith(q)) return 0;
  if (folded.includes(q)) return 1;
  if (tokens.length > 1 && tokens.every((t) => folded.includes(t))) return 2;
  if (squashedQ.length >= 3 && isSubsequence(squashedQ, folded.replace(/\s+/g, ""))) return 3;
  return -1;
}

/**
 * Filter + rank a list by name. An empty query returns everything sorted by name.
 * Pre-fold the names once (see `foldNames`) when the list is large.
 */
export function rankedFilter<T>(
  items: { item: T; folded: string; name: string }[],
  query: string,
): T[] {
  const q = fold(query);
  if (!q) {
    return items.slice().sort((a, b) => a.name.localeCompare(b.name, "ro")).map((x) => x.item);
  }
  const tokens = q.split(/\s+/).filter(Boolean);
  const squashed = q.replace(/\s+/g, "");
  const scored: { item: T; name: string; r: number }[] = [];
  for (const { item, folded, name } of items) {
    const r = rank(folded, q, tokens, squashed);
    if (r >= 0) scored.push({ item, name, r });
  }
  scored.sort((a, b) => a.r - b.r || a.name.localeCompare(b.name, "ro"));
  return scored.map((s) => s.item);
}

/** Pre-fold a list of named things once, for repeated filtering. */
export function foldNames<T extends { name: string }>(list: T[]): { item: T; folded: string; name: string }[] {
  return list.map((item) => ({ item, folded: fold(item.name), name: item.name }));
}
