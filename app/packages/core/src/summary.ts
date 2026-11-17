import { addDays, daysBetween, inclusiveDays, startOfDay } from "./dates";
import type { Income } from "./income";
import type { Cents } from "./money";
import { getCurrentPeriod, periodLength, type Period, type PeriodSettings } from "./period";
import type { TermPlan } from "./termPlan";
import type { Category, Transaction } from "./types";

export interface CategorySpend {
  // null = uncategorized
  categoryId: string | null;
  amount: Cents;
}

export interface Spending {
  total: Cents;
  // biggest first
  byCategory: CategorySpend[];
}

// money out between two days (inclusive), by category; savings moves and income categories are not spending
export function getSpending(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  start: Date,
  end: Date,
): Spending {
  const excluded = new Set(categories.filter((c) => c.kind === "savings" || c.kind === "income").map((c) => c.id));
  const known = new Set(categories.map((c) => c.id));
  const totals = new Map<string | null, Cents>();
  let total = 0;

  // add up outflows in range; a deleted category counts as uncategorized
  for (const t of transactions) {
    if (t.amount <= 0) continue;
    if (t.categoryId && excluded.has(t.categoryId)) continue;
    if (daysBetween(start, t.date) < 0 || daysBetween(t.date, end) < 0) continue;
    const key = t.categoryId && known.has(t.categoryId) ? t.categoryId : null;
    totals.set(key, (totals.get(key) ?? 0) + t.amount);
    total += t.amount;
  }

  const byCategory = [...totals].map(([categoryId, amount]) => ({ categoryId, amount })).sort((a, b) => b.amount - a.amount);
  return { total, byCategory };
}

// the budget period just before this one, or null when there isn't a comparable one
export function getPreviousPeriod(
  period: Period,
  settings: PeriodSettings,
  incomes: readonly Income[],
  termPlans: readonly TermPlan[],
): Period | null {
  void settings;
  // the period as it stood the day before this one began
  const previous = getCurrentPeriod({ budgetPeriod: period.kind }, incomes, termPlans, addDays(period.start, -1));
  if (previous.kind === period.kind && daysBetween(previous.end, period.start) > 0) return previous;

  // paydays aren't known before the stored one, so regular pay falls back to a window of the same length
  if (period.kind === "paycheque" && incomes.some((i) => i.nextPaymentDate && i.frequency !== "one_time")) {
    return { kind: "paycheque", start: addDays(period.start, -periodLength(period)), end: addDays(period.start, -1) };
  }
  return null;
}

export interface PeriodComparison {
  // how many days into the period today is, which is also how many days of the previous period were counted
  dayOfPeriod: number;
  previousTotal: Cents;
  // whole percent, negative = spending less; null when there is nothing to compare against
  changePercent: number | null;
}

export interface PeriodSummary extends Spending {
  period: Period;
  comparison: PeriodComparison | null;
}

// spending so far this period, with a like-for-like comparison: day N against day N of the previous period
export function summarizePeriod(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  period: Period,
  previous: Period | null,
  now: Date,
): PeriodSummary {
  const today = startOfDay(now);
  const spending = getSpending(transactions, categories, period.start, today);
  let comparison: PeriodComparison | null = null;

  // same number of days from the start of the previous period, capped at its length
  if (previous) {
    const dayOfPeriod = Math.max(1, inclusiveDays(period.start, today));
    const days = Math.min(dayOfPeriod, periodLength(previous));
    const previousTotal = getSpending(transactions, categories, previous.start, addDays(previous.start, days - 1)).total;
    const changePercent = previousTotal > 0 ? Math.round(((spending.total - previousTotal) * 100) / previousTotal) : null;
    comparison = { dayOfPeriod, previousTotal, changePercent };
  }
  return { ...spending, period, comparison };
}

export interface WeeklySummary {
  // Monday to Sunday containing `day`
  start: Date;
  end: Date;
  spent: Cents;
  lastWeekSpent: Cents;
  topCategories: CategorySpend[];
}

// the Monday-to-Sunday week containing `day`: spent against the week before, and the top 3 categories
export function getWeeklySummary(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  day: Date,
): WeeklySummary {
  const d = startOfDay(day);
  const start = addDays(d, -((d.getDay() + 6) % 7));
  const end = addDays(start, 6);
  const week = getSpending(transactions, categories, start, end);
  const last = getSpending(transactions, categories, addDays(start, -7), addDays(start, -1));
  return { start, end, spent: week.total, lastWeekSpent: last.total, topCategories: week.byCategory.slice(0, 3) };
}
