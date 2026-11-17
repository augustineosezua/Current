import { getBillsDueBy, type Bill } from "./bills";
import { addDays, daysBetween, inclusiveDays, maxDate, startOfDay } from "./dates";
import {
  fundInPriorityOrder,
  getGoalContribution,
  hasExplicitStsPositioning,
  sortGoalsByPriority,
  ABOVE_STS_PRIORITY,
  type Goal,
  type GoalAllocation,
} from "./goals";
import { getNextIncome, type Income } from "./income";
import type { Cents } from "./money";
import { getCurrentPeriod, periodLength, type Period, type PeriodSettings } from "./period";
import { getTotalTermReserve, type TermPlan } from "./termPlan";
import type { Account, Category, Transaction } from "./types";

// bills due within this many days always count, even past the period end
const BILL_LOOKAHEAD_DAYS = 7;

export interface StsSettings extends PeriodSettings {
  // monthly spending the user wants protected before goals; prorated to the period
  minimumMonthlySpend: Cents;
}

export interface StsInput {
  accounts: readonly Account[];
  bills: readonly Bill[];
  goals: readonly Goal[];
  incomes: readonly Income[];
  termPlans: readonly TermPlan[];
  transactions: readonly Transaction[];
  categories: readonly Category[];
  settings: StsSettings;
}

export interface StsBreakdown {
  spendableBalance: Cents;
  billsTotal: Cents;
  termReserve: Cents;
  committedGoals: Cents;
  spendingFloor: Cents;
}

export interface StsResult {
  safeToSpend: Cents;
  breakdown: StsBreakdown;
  goals: {
    // contributions reserved out of STS this period
    funded: GoalAllocation[];
    // goals the balance couldn't reach this period
    ignored: Goal[];
    // below-STS goals that what's left of STS could fund (informational, not deducted)
    fromSts: GoalAllocation[];
  };
  billsCounted: Bill[];
  availableAfter: { amount: Cents; date: Date } | null;
  daily: { perDay: Cents; daysLeft: number; periodEnd: Date };
  period: Period;
}

interface GoalPlan {
  explicit: boolean;
  above: GoalAllocation[];
  below: GoalAllocation[];
  aboveTotal: Cents;
}

interface Allocation {
  sts: Cents;
  funded: GoalAllocation[];
  ignored: Goal[];
  fromSts: GoalAllocation[];
}

// money that can actually be spent: chequing and cash, never savings
function spendableBalance(accounts: readonly Account[]): Cents {
  let total = 0;
  for (const a of accounts) if (a.type !== "savings") total += a.balance;
  return total;
}

// split this period's goal contributions into above-STS and below-STS lists
function planGoals(goals: readonly Goal[], period: Period): GoalPlan {
  const explicit = hasExplicitStsPositioning(goals);
  const above: GoalAllocation[] = [];
  const below: GoalAllocation[] = [];

  // without explicit positioning every goal sits above STS
  for (const goal of sortGoalsByPriority(goals)) {
    const amount = getGoalContribution(goal, period);
    if (amount <= 0) continue;
    if (!explicit || goal.priority >= ABOVE_STS_PRIORITY) above.push({ goal, amount });
    else below.push({ goal, amount });
  }
  return { explicit, above, below, aboveTotal: above.reduce((s, g) => s + g.amount, 0) };
}

// spending floor for this period minus what's already been spent in it
function remainingSpendingFloor(input: StsInput, period: Period, now: Date): Cents {
  const monthly = input.settings.minimumMonthlySpend;
  if (monthly <= 0) return 0;
  const floor = period.kind === "monthly" ? monthly : Math.round((monthly * periodLength(period) * 12) / 365);
  const excluded = new Set(input.categories.filter((c) => c.kind === "savings" || c.kind === "income").map((c) => c.id));
  const today = startOfDay(now);
  let spent = 0;

  // outflows this period, excluding bill payments, savings moves and income
  for (const t of input.transactions) {
    if (t.amount <= 0 || t.createdFromBill) continue;
    if (t.categoryId && excluded.has(t.categoryId)) continue;
    if (daysBetween(period.start, t.date) < 0 || daysBetween(t.date, today) < 0) continue;
    spent += t.amount;
  }
  return Math.max(floor - spent, 0);
}

// fund goals from what's left after bills and term reserve, protecting the spending floor
function allocate(available: Cents, plan: GoalPlan, floor: Cents): Allocation {
  let sts: Cents;
  let funded: GoalAllocation[];
  let ignored: Goal[];

  // explicit above-STS goals behave like bills: deducted in full, no floor protection
  if (plan.explicit) {
    ({ funded, ignored } = fundInPriorityOrder(plan.above, Math.max(available, 0)));
    sts = Math.max(available - plan.aboveTotal, 0);
  } else if (available >= floor) {
    const result = fundInPriorityOrder(plan.above, available - floor);
    funded = result.funded;
    ignored = result.ignored;
    sts = result.remaining + floor;
  } else {
    // can't even cover the floor: no goals this period
    funded = [];
    ignored = plan.above.map((a) => a.goal);
    sts = Math.max(available, 0);
  }

  const fromSts = plan.explicit ? fundInPriorityOrder(plan.below, sts).funded : [];
  return { sts, funded, ignored, fromSts };
}

// Safe-to-Spend: spendable balance minus bills, term reserve and goal contributions
export function calculateSafeToSpend(input: StsInput, now: Date): StsResult {
  const today = startOfDay(now);
  const period = getCurrentPeriod(input.settings, input.incomes, input.termPlans, now);
  const balance = spendableBalance(input.accounts);

  const billsCutoff = maxDate(period.end, addDays(today, BILL_LOOKAHEAD_DAYS));
  const billsCounted = getBillsDueBy(input.bills, billsCutoff);
  const billsTotal = billsCounted.reduce((s, b) => s + b.amount, 0);

  const termReserve = getTotalTermReserve(input.termPlans, now);
  const plan = planGoals(input.goals, period);
  const floor = remainingSpendingFloor(input, period, now);

  const available = balance - billsTotal - termReserve;
  const result = allocate(available, plan, floor);

  // when STS is 0, show what frees up after the next paycheque
  let availableAfter: StsResult["availableAfter"] = null;
  if (result.sts === 0) {
    const next = getNextIncome(input.incomes, now);
    if (next) availableAfter = { amount: allocate(available + next.income.amount, plan, floor).sts, date: next.date };
  }

  // daily number counts term money that releases before the period ends
  const reserveAtPeriodEnd = getTotalTermReserve(input.termPlans, period.end);
  const periodSts = allocate(balance - billsTotal - reserveAtPeriodEnd, plan, floor).sts;
  const daysLeft = Math.max(1, inclusiveDays(today, period.end));

  const committedGoals = plan.explicit ? plan.aboveTotal : result.funded.reduce((s, g) => s + g.amount, 0);

  return {
    safeToSpend: result.sts,
    breakdown: { spendableBalance: balance, billsTotal, termReserve, committedGoals, spendingFloor: floor },
    goals: { funded: result.funded, ignored: result.ignored, fromSts: result.fromSts },
    billsCounted,
    availableAfter,
    daily: { perDay: Math.floor(periodSts / daysLeft), daysLeft, periodEnd: period.end },
    period,
  };
}
