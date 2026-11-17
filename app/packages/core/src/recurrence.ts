import { addDays, addMonthsClamped, daysBetween, startOfDay } from "./dates";

export type Frequency =
  | "one_time"
  | "daily"
  | "weekly"
  | "biweekly"
  | "semimonthly"
  | "monthly"
  | "yearly";

const DAY_STEPS: Partial<Record<Frequency, number>> = { daily: 1, weekly: 7, biweekly: 14 };

// one semimonthly step (1st and 15th), forward or back
function semimonthlyStep(d: Date, direction: 1 | -1): Date {
  const day = d.getDate();
  // forward: 1st..14th -> 15th, 15th+ -> 1st of next month
  if (direction === 1) {
    return day < 15 ? new Date(d.getFullYear(), d.getMonth(), 15) : new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }
  // back: after 15th -> 15th, 2nd..15th -> 1st, 1st -> 15th of previous month
  if (day > 15) return new Date(d.getFullYear(), d.getMonth(), 15);
  if (day > 1) return new Date(d.getFullYear(), d.getMonth(), 1);
  return new Date(d.getFullYear(), d.getMonth() - 1, 15);
}

// the k-th occurrence from an anchor date (k may be negative); null for one-time
export function occurrence(anchor: Date, frequency: Frequency, k: number, anchorDay = anchor.getDate()): Date | null {
  const base = startOfDay(anchor);
  if (frequency === "one_time") return k === 0 ? base : null;
  const step = DAY_STEPS[frequency];
  if (step !== undefined) return addDays(base, step * k);
  if (frequency === "monthly") return addMonthsClamped(base, k, anchorDay);
  if (frequency === "yearly") return addMonthsClamped(base, 12 * k, anchorDay);

  // semimonthly walks step by step
  let d = base;
  const dir = k >= 0 ? 1 : -1;
  for (let i = 0; i < Math.abs(k); i++) d = semimonthlyStep(d, dir);
  return d;
}

// smallest k whose occurrence falls strictly after `day`
export function firstOccurrenceIndexAfter(anchor: Date, frequency: Frequency, day: Date, anchorDay = anchor.getDate()): number | null {
  if (frequency === "one_time") return daysBetween(day, anchor) > 0 ? 0 : null;
  const step = DAY_STEPS[frequency];

  // fixed-length steps can jump straight to the answer
  if (step !== undefined) {
    const diff = daysBetween(anchor, day);
    return diff < 0 ? 0 : Math.floor(diff / step) + 1;
  }

  let k = 0;
  let current = occurrence(anchor, frequency, k, anchorDay);
  // walk back while the previous occurrence is still after `day`
  while (current && daysBetween(day, current) > 0) {
    const prev = occurrence(anchor, frequency, k - 1, anchorDay);
    if (!prev || daysBetween(day, prev) <= 0) return k;
    k--;
    current = prev;
  }
  // walk forward until past `day`
  while (current && daysBetween(day, current) <= 0) {
    k++;
    current = occurrence(anchor, frequency, k, anchorDay);
  }
  return k;
}
