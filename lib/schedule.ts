/* ============================================================================
 *  Ordering schedule rules.
 *  ----------------------------------------------------------------------------
 *  Ma'Maria operates on working days only (Mon–Fri). We evaluate the weekday in
 *  the restaurant's timezone (Europe/Chisinau) rather than the server's, so a
 *  UTC-hosted server (Railway) doesn't misjudge the day near midnight.
 * ========================================================================== */

const TZ = "Europe/Chisinau";

/** How many days ahead Bucate can be ordered (working days within this window). */
export const ADVANCE_DAYS = 7;

/** True Monday–Friday (restaurant local time). */
export function isWorkingDay(now: Date = new Date()): boolean {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(now);
  return wd !== "Sat" && wd !== "Sun";
}

/** Today's calendar date (YYYY-MM-DD) in the restaurant's timezone. */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Current wall-clock time "HH:MM" in the restaurant's timezone (for the cutoff). */
export function nowHHMM(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
}

/** Working-day check for a bare calendar date string (YYYY-MM-DD). */
export function isWorkingDayISO(dateStr: string): boolean {
  const d = new Date(`${dateStr}T12:00:00Z`);
  if (isNaN(d.getTime())) return false;
  return isWorkingDay(d);
}

/**
 * Validate a requested pickup date: must be a valid working day within
 * [today, today+ADVANCE_DAYS]. Returns a reason string if invalid, else null.
 */
export function validatePickupDate(dateStr: string, now: Date = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return "Data de ridicare este invalidă.";
  const today = todayISO(now);
  if (dateStr < today) return "Data de ridicare este în trecut.";
  const max = new Date(`${today}T12:00:00Z`);
  max.setUTCDate(max.getUTCDate() + ADVANCE_DAYS);
  const maxISO = todayISO(max);
  if (dateStr > maxISO) return `Comenzile se pot plasa cu cel mult ${ADVANCE_DAYS} zile înainte.`;
  if (!isWorkingDayISO(dateStr)) return WORKING_DAYS_NOTICE;
  return null;
}

/** The selectable working-day dates for the advance picker (today … +ADVANCE_DAYS). */
export function orderableDates(now: Date = new Date()): string[] {
  const out: string[] = [];
  const start = new Date(`${todayISO(now)}T12:00:00Z`);
  for (let i = 0; i <= ADVANCE_DAYS; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const iso = todayISO(d);
    if (isWorkingDayISO(iso)) out.push(iso);
  }
  return out;
}

export const WORKING_DAYS_NOTICE =
  "Comenzile se preiau doar în zilele lucrătoare (luni–vineri).";

/** How far in advance customers should order (informational copy). */
export const LEAD_TIME_NOTICE =
  "Comenzile se fac cu 24 de ore înainte de data necesară.";
