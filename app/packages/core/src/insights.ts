// 2.8 Insights (Plus) and 2.10 weekly recap: spending by day, week and category for any range.
import { addDays, daysBetween, inclusiveDays, startOfDay } from "./dates";
import type { Cents } from "./money";
import { calculateSafeToSpend, type StsInput } from "./sts";
import { getSpending, type CategorySpend } from "./summary";
import type { Category, Transaction } from "./types";

// inclusive calendar-day range
export interface DayRange {
  start: Date;
  end: Date;
}

export interface DaySpend {
  date: Date;
  amount: Cents;
}

// spending on each day of a range, zero days included; savings and income are not spending
export function getDailySpending(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  start: Date,
  end: Date,
): DaySpend[] {
  const excluded = new Set(categories.filter((c) => c.kind === "savings" || c.kind === "income").map((c) => c.id));
  const first = startOfDay(start);
  const days: DaySpend[] = [];
  for (let i = 0; i < inclusiveDays(first, end); i++) days.push({ date: addDays(first, i), amount: 0 });

  // drop each outflow into its day
  for (const t of transactions) {
    if (t.amount <= 0 || (t.categoryId && excluded.has(t.categoryId))) continue;
    const slot = days[daysBetween(first, t.date)];
    if (slot) slot.amount += t.amount;
  }
  return days;
}

// Monday of the week containing `day`
export function startOfWeek(day: Date): Date {
  const d = startOfDay(day);
  return addDays(d, -((d.getDay() + 6) % 7));
}

export interface WeekSpend extends DayRange {
  amount: Cents;
}

// the last `weeks` Monday-to-Sunday weeks, oldest first, the last one containing `now`
export function getWeeklyTotals(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  now: Date,
  weeks = 8,
): WeekSpend[] {
  const thisWeek = startOfWeek(now);
  const out: WeekSpend[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    const end = addDays(start, 6);
    out.push({ start, end, amount: getSpending(transactions, categories, start, end).total });
  }
  return out;
}

// a range of the same length ending the day before this one starts
export function previousRange(range: DayRange): DayRange {
  const length = inclusiveDays(range.start, range.end);
  return { start: addDays(startOfDay(range.start), -length), end: addDays(startOfDay(range.start), -1) };
}

export interface CategoryComparison {
  categoryId: string | null;
  amount: Cents;
  previous: Cents;
  // amount minus previous
  change: Cents;
  // whole percent; null when there was nothing before
  changePercent: number | null;
}

// spending per category in a range next to another range, biggest current spend first
export function compareCategories(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  range: DayRange,
  previous: DayRange,
): CategoryComparison[] {
  const now = getSpending(transactions, categories, range.start, range.end).byCategory;
  const before = new Map(getSpending(transactions, categories, previous.start, previous.end).byCategory.map((c) => [c.categoryId, c.amount]));
  const ids = new Set<string | null>([...now.map((c) => c.categoryId), ...before.keys()]);
  const current = new Map(now.map((c) => [c.categoryId, c.amount]));

  return [...ids]
    .map((categoryId) => {
      const amount = current.get(categoryId) ?? 0;
      const prev = before.get(categoryId) ?? 0;
      return {
        categoryId,
        amount,
        previous: prev,
        change: amount - prev,
        changePercent: prev > 0 ? Math.round(((amount - prev) * 100) / prev) : null,
      };
    })
    .sort((a, b) => b.amount - a.amount || b.previous - a.previous);
}

export interface WeeklyRecap extends DayRange {
  spent: Cents;
  lastWeekSpent: Cents;
  // spent minus last week
  change: Cents;
  topCategories: CategorySpend[];
  // the category whose spending moved most against last week
  biggestChange: CategoryComparison | null;
  // the daily number as of now
  perDay: Cents;
  periodEnd: Date;
}

// the week to recap: the one ending today on a Sunday, otherwise the last full Monday-to-Sunday week
export function recapWeek(now: Date): DayRange {
  const today = startOfDay(now);
  const end = today.getDay() === 0 ? today : addDays(startOfWeek(today), -1);
  return { start: addDays(end, -6), end };
}

// figures for the Sunday recap; the AI layer only turns these into sentences
export function getWeeklyRecap(input: StsInput, now: Date): WeeklyRecap {
  const week = recapWeek(now);
  const last = previousRange(week);
  const spending = getSpending(input.transactions, input.categories, week.start, week.end);
  const lastWeekSpent = getSpending(input.transactions, input.categories, last.start, last.end).total;
  const rows = compareCategories(input.transactions, input.categories, week, last);
  const biggestChange = rows.reduce<CategoryComparison | null>(
    (best, r) => (r.change !== 0 && (!best || Math.abs(r.change) > Math.abs(best.change)) ? r : best),
    null,
  );
  const sts = calculateSafeToSpend(input, now);

  return {
    ...week,
    spent: spending.total,
    lastWeekSpent,
    change: spending.total - lastWeekSpent,
    topCategories: spending.byCategory.slice(0, 3),
    biggestChange,
    perDay: sts.daily.perDay,
    periodEnd: sts.daily.periodEnd,
  };
}

// running total of a run of days, for a pace line
export function cumulative(days: readonly DaySpend[]): Cents[] {
  let sum = 0;
  return days.map((day) => (sum += day.amount));
}

export interface MonthSpend extends DayRange {
  amount: Cents;
}

// the last `months` calendar months, oldest first, the last one containing `now` (so far)
export function getMonthlyTotals(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  now: Date,
  months = 6,
): MonthSpend[] {
  const out: MonthSpend[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = i === 0 ? startOfDay(now) : new Date(start.getFullYear(), start.getMonth() + 1, 0);
    out.push({ start, end, amount: getSpending(transactions, categories, start, end).total });
  }
  return out;
}

export interface WeekdaySpend {
  // 0 is Monday, 6 is Sunday
  weekday: number;
  total: Cents;
  // total over how many of that weekday the range holds, rounded to the cent
  average: Cents;
}

// spending by day of the week across a range, Monday first
export function getWeekdayAverages(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  range: DayRange,
): WeekdaySpend[] {
  const out = Array.from({ length: 7 }, (_, weekday) => ({ weekday, total: 0, days: 0 }));
  for (const day of getDailySpending(transactions, categories, range.start, range.end)) {
    const slot = out[(day.date.getDay() + 6) % 7]!;
    slot.total += day.amount;
    slot.days += 1;
  }
  return out.map(({ weekday, total, days }) => ({ weekday, total, average: days > 0 ? Math.round(total / days) : 0 }));
}

export interface MerchantSpend {
  name: string;
  amount: Cents;
  count: number;
}

// where the money went in a range: the biggest merchants by total, names matched ignoring case and spacing
export function getTopMerchants(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  range: DayRange,
  limit = 5,
): MerchantSpend[] {
  const excluded = new Set(categories.filter((c) => c.kind === "savings" || c.kind === "income").map((c) => c.id));
  const totals = new Map<string, MerchantSpend>();
  for (const t of transactions) {
    const name = t.merchantName?.trim();
    if (!name || t.amount <= 0 || (t.categoryId && excluded.has(t.categoryId))) continue;
    if (daysBetween(range.start, t.date) < 0 || daysBetween(t.date, range.end) < 0) continue;
    const key = name.toLowerCase().replace(/\s+/g, " ");
    const row = totals.get(key) ?? { name, amount: 0, count: 0 };
    row.amount += t.amount;
    row.count += 1;
    totals.set(key, row);
  }
  return [...totals.values()].sort((a, b) => b.amount - a.amount || b.count - a.count).slice(0, limit);
}
