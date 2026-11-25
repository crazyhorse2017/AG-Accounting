/** "Daily content changes": pick items by the date in Ohio (Eastern Time). No server needed. */

/** Year, month, day in America/New_York for a moment in time. */
export function easternDate(now: Date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** Whole days since 1970-01-01 for an Eastern calendar date (stable all day long in Ohio). */
export function dayNumber(now: Date = new Date()): number {
  const { year, month, day } = easternDate(now);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

/** The item for today, rotating through the list. Shuffled by a fixed step so neighbors differ. */
export function pickForDay<T>(items: readonly T[], now: Date = new Date(), offset = 0): T | null {
  if (items.length === 0) return null;
  const n = items.length;
  const step = n > 7 ? 7 : 1;
  const coprimeStep = gcd(step, n) === 1 ? step : 1;
  const index = (((dayNumber(now) + offset) * coprimeStep) % n + n) % n;
  return items[index];
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Items whose "MM-DD" matches today's Eastern date ("this day in tax history"). */
export function onThisDay<T extends { monthDay?: string | null }>(items: readonly T[], now: Date = new Date()): T[] {
  const { month, day } = easternDate(now);
  const key = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return items.filter((i) => i.monthDay === key);
}
