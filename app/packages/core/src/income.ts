import { daysBetween, startOfDay } from "./dates";
import type { Cents } from "./money";
import { firstOccurrenceIndexAfter, occurrence, type Frequency } from "./recurrence";

export interface Income {
  id: string;
  name?: string;
  amount: Cents;
  frequency: Frequency;
  // any known payday; rolled forward in memory, never written back
  nextPaymentDate: Date | null;
  // intended day of month for monthly/yearly pay when the stored date was clamped (e.g. 31)
  anchorDay?: number;
}

// next payday strictly after today (a payday today is treated as received)
export function getNextPaymentDate(income: Income, now: Date): Date | null {
  if (!income.nextPaymentDate) return null;
  const anchor = startOfDay(income.nextPaymentDate);
  const anchorDay = income.anchorDay ?? anchor.getDate();
  const k = firstOccurrenceIndexAfter(anchor, income.frequency, startOfDay(now), anchorDay);
  if (k === null) return null;
  return occurrence(anchor, income.frequency, k, anchorDay);
}

// most recent payday on or before today
export function getPreviousPaymentDate(income: Income, now: Date): Date | null {
  if (!income.nextPaymentDate) return null;
  const anchor = startOfDay(income.nextPaymentDate);
  const today = startOfDay(now);
  // one-time income only has a past payday once its date has passed
  if (income.frequency === "one_time") return daysBetween(anchor, today) >= 0 ? anchor : null;
  const anchorDay = income.anchorDay ?? anchor.getDate();
  const k = firstOccurrenceIndexAfter(anchor, income.frequency, today, anchorDay);
  if (k === null) return null;
  return occurrence(anchor, income.frequency, k - 1, anchorDay);
}

// soonest upcoming payday across all incomes
export function getNextIncome(incomes: readonly Income[], now: Date): { income: Income; date: Date } | null {
  let best: { income: Income; date: Date } | null = null;
  for (const income of incomes) {
    const date = getNextPaymentDate(income, now);
    if (date && (!best || date.getTime() < best.date.getTime())) best = { income, date };
  }
  return best;
}
