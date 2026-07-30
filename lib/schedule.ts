/* ============================================================================
 *  Ordering schedule rules.
 *  ----------------------------------------------------------------------------
 *  Ma'Maria operates on working days only (Mon–Fri). We evaluate the weekday in
 *  the restaurant's timezone (Europe/Chisinau) rather than the server's, so a
 *  UTC-hosted server (Railway) doesn't misjudge the day near midnight.
 * ========================================================================== */

const TZ = "Europe/Chisinau";

/** True Monday–Friday (restaurant local time). */
export function isWorkingDay(now: Date = new Date()): boolean {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(now);
  return wd !== "Sat" && wd !== "Sun";
}

export const WORKING_DAYS_NOTICE =
  "Comenzile se preiau doar în zilele lucrătoare (luni–vineri).";

/** How far in advance customers should order (informational copy). */
export const LEAD_TIME_NOTICE =
  "Comenzile se fac cu 24 de ore înainte de data necesară.";
