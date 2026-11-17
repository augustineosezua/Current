import { addDays, endOfMonth, inclusiveDays, isWithin, startOfDay, startOfMonth } from "./dates";
import { getNextPaymentDate, getPreviousPaymentDate, type Income } from "./income";
import type { TermPlan } from "./termPlan";

export type BudgetPeriodKind = "monthly" | "paycheque" | "term";

export interface PeriodSettings {
  // unset means "use the default"
  budgetPeriod?: BudgetPeriodKind | null;
}

// inclusive calendar-day range
export interface Period {
  kind: BudgetPeriodKind;
  start: Date;
  end: Date;
}

// paycheque when any income has an upcoming date, otherwise monthly
export function defaultBudgetPeriod(incomes: readonly Income[], now: Date): BudgetPeriodKind {
  return incomes.some((i) => getNextPaymentDate(i, now) !== null) ? "paycheque" : "monthly";
}

// number of days in a period
export function periodLength(period: Period): number {
  return inclusiveDays(period.start, period.end);
}

// calendar month containing today
function monthlyPeriod(now: Date): Period {
  return { kind: "monthly", start: startOfMonth(now), end: endOfMonth(now) };
}

// last payday on or before today through the day before the next payday
function paychequePeriod(incomes: readonly Income[], now: Date): Period | null {
  const today = startOfDay(now);
  let next: Date | null = null;
  let previous: Date | null = null;

  // soonest next payday and latest previous payday across incomes
  for (const income of incomes) {
    const n = getNextPaymentDate(income, now);
    if (n && (!next || n < next)) next = n;
    const p = getPreviousPaymentDate(income, now);
    if (p && (!previous || p > previous)) previous = p;
  }
  if (!next) return null;
  return { kind: "paycheque", start: previous ?? today, end: addDays(next, -1) };
}

// the active term plan covering today, earliest-ending first
function termPeriod(plans: readonly TermPlan[], now: Date): Period | null {
  const today = startOfDay(now);
  const covering = plans
    .filter((p) => p.isActive && isWithin(today, p.startDate, p.endDate))
    .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
  const plan = covering[0];
  if (!plan) return null;
  return { kind: "term", start: startOfDay(plan.startDate), end: startOfDay(plan.endDate) };
}

// the current budget period, falling back to monthly when the chosen kind has no data
export function getCurrentPeriod(
  settings: PeriodSettings,
  incomes: readonly Income[],
  termPlans: readonly TermPlan[],
  now: Date,
): Period {
  const kind = settings.budgetPeriod ?? defaultBudgetPeriod(incomes, now);
  if (kind === "paycheque") return paychequePeriod(incomes, now) ?? monthlyPeriod(now);
  if (kind === "term") return termPeriod(termPlans, now) ?? monthlyPeriod(now);
  return monthlyPeriod(now);
}
