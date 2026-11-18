// 2.3 Category budgets and 2.12 rollover. Limits are guidance only: they never feed into Safe-to-Spend,
// which already counts bills and goals, so this would double count.
import { daysBetween, maxDate, startOfDay } from "./dates";
import type { Income } from "./income";
import type { Cents } from "./money";
import type { Period, PeriodSettings } from "./period";
import { getPreviousPeriod } from "./summary";
import type { TermPlan } from "./termPlan";
import type { Category, Transaction } from "./types";

export interface CategoryBudget {
  categoryId: string;
  // per budget period, whatever its length
  limit: Cents;
  rollover: boolean;
  // rollover counts from the period containing this day
  since: Date;
}

// 0 = fine, 90 = at or past 90%, 100 = over
export type BudgetThreshold = 0 | 90 | 100;

export interface CategoryBudgetStatus {
  categoryId: string;
  limit: Cents;
  // carried in from earlier periods; negative after overspending
  carry: Cents;
  available: Cents;
  spent: Cents;
  // negative once over
  left: Cents;
  threshold: BudgetThreshold;
}

// what the period history needs to walk back through earlier periods
export interface PeriodContext {
  settings: PeriodSettings;
  incomes: readonly Income[];
  termPlans: readonly TermPlan[];
}

// rollover looks back at most this many periods
const MAX_ROLLOVER_PERIODS = 36;

// money out per category between two days; refunds net off, never below zero
function spentByCategory(transactions: readonly Transaction[], start: Date, end: Date): Map<string, Cents> {
  const totals = new Map<string, Cents>();
  for (const t of transactions) {
    if (!t.categoryId || daysBetween(start, t.date) < 0 || daysBetween(t.date, end) < 0) continue;
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount);
  }
  for (const [id, amount] of totals) totals.set(id, Math.max(amount, 0));
  return totals;
}

// left over (or overspent) from earlier periods; 0 when rollover is off
export function getRolloverCarry(
  budget: CategoryBudget,
  transactions: readonly Transaction[],
  categories: readonly Category[],
  period: Period,
  context: PeriodContext,
): Cents {
  void categories;
  if (!budget.rollover) return 0;
  const since = startOfDay(budget.since);

  // earlier periods back to the one containing `since`, newest first
  const earlier: Period[] = [];
  let p = getPreviousPeriod(period, context.settings, context.incomes, context.termPlans);
  while (p && daysBetween(since, p.end) >= 0 && earlier.length < MAX_ROLLOVER_PERIODS) {
    earlier.push(p);
    p = getPreviousPeriod(p, context.settings, context.incomes, context.termPlans);
  }

  // oldest first: each period gets its limit plus what came before, minus what it spent
  let carry = 0;
  for (const past of earlier.reverse()) {
    const spent = spentByCategory(transactions, past.start, past.end).get(budget.categoryId) ?? 0;
    carry += budget.limit - spent;
  }
  return carry;
}

// where each budget stands this period, as of today
export function getCategoryBudgetStatuses(
  budgets: readonly CategoryBudget[],
  transactions: readonly Transaction[],
  categories: readonly Category[],
  period: Period,
  now: Date,
  context: PeriodContext,
): CategoryBudgetStatus[] {
  const live = new Set(categories.map((c) => c.id));
  const today = startOfDay(now);
  const end = daysBetween(today, period.end) < 0 ? period.end : maxDate(today, period.start);
  const spent = spentByCategory(transactions, period.start, end);

  return budgets
    .filter((b) => live.has(b.categoryId))
    .map((b) => {
      const carry = getRolloverCarry(b, transactions, categories, period, context);
      const available = b.limit + carry;
      const s = spent.get(b.categoryId) ?? 0;
      const threshold: BudgetThreshold = s > available ? 100 : s * 10 >= available * 9 && s > 0 ? 90 : 0;
      return { categoryId: b.categoryId, limit: b.limit, carry, available, spent: s, left: available - s, threshold };
    });
}

export interface KindTotals {
  spent: Cents;
  limit: Cents;
}

// spending and limits for needs against wants this period; `other` is uncategorized spending
export function getNeedsWantsSplit(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  budgets: readonly CategoryBudget[],
  period: Period,
  now: Date,
): { needs: KindTotals; wants: KindTotals; other: Cents } {
  const kinds = new Map(categories.map((c) => [c.id, c.kind]));
  const result = { needs: { spent: 0, limit: 0 }, wants: { spent: 0, limit: 0 }, other: 0 };
  const today = startOfDay(now);
  const end = daysBetween(today, period.end) < 0 ? period.end : today;

  // money out by kind; savings and income aren't spending
  for (const t of transactions) {
    if (t.amount <= 0 || daysBetween(period.start, t.date) < 0 || daysBetween(t.date, end) < 0) continue;
    const kind = t.categoryId ? kinds.get(t.categoryId) : undefined;
    if (kind === "needs" || kind === "wants") result[kind].spent += t.amount;
    else if (!kind) result.other += t.amount;
  }
  for (const b of budgets) {
    const kind = kinds.get(b.categoryId);
    if (kind === "needs" || kind === "wants") result[kind].limit += b.limit;
  }
  return result;
}

export interface BudgetAlert {
  categoryId: string;
  threshold: 90 | 100;
  // stable id for "already sent": category, period start and threshold
  key: string;
  left: Cents;
}

// "2027-01-01" for keys
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// thresholds crossed this period that haven't been announced; jumping past 100% skips the 90% one
export function getNewBudgetAlerts(
  statuses: readonly CategoryBudgetStatus[],
  period: Period,
  sent: readonly string[],
): BudgetAlert[] {
  const already = new Set(sent);
  const alerts: BudgetAlert[] = [];
  for (const s of statuses) {
    if (s.threshold === 0) continue;
    const key = `${s.categoryId}:${ymd(period.start)}:${s.threshold}`;
    if (!already.has(key)) alerts.push({ categoryId: s.categoryId, threshold: s.threshold, key, left: s.left });
  }
  return alerts;
}
