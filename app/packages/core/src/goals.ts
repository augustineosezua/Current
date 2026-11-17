import { daysBetween, inclusiveDays, isWithin, startOfDay } from "./dates";
import type { Cents } from "./money";
import { periodLength, type Period } from "./period";

// goals at or above this priority reduce STS directly; below it they are funded from what STS leaves
export const ABOVE_STS_PRIORITY = 1000;

export interface Goal {
  id: string;
  name: string;
  // target for one-time goals, monthly amount for recurring goals
  amount: Cents;
  amountSaved: Cents;
  dueDate: Date;
  priority: number;
  isRecurring: boolean;
  isCompleted: boolean;
  // set when a contribution was committed; one contribution per period
  lastContributionAt: Date | null;
}

export interface GoalAllocation {
  goal: Goal;
  amount: Cents;
}

// highest priority first, then soonest due
export function sortGoalsByPriority(goals: readonly Goal[]): Goal[] {
  return [...goals].sort((a, b) => b.priority - a.priority || a.dueDate.getTime() - b.dueDate.getTime());
}

// true once any goal has been explicitly placed above STS
export function hasExplicitStsPositioning(goals: readonly Goal[]): boolean {
  return goals.some((g) => g.priority >= ABOVE_STS_PRIORITY);
}

// what a goal needs this period; 0 when complete or already contributed this period
export function getGoalContribution(goal: Goal, period: Period): Cents {
  if (goal.isCompleted) return 0;
  if (goal.lastContributionAt && isWithin(goal.lastContributionAt, period.start, period.end)) return 0;
  const days = periodLength(period);

  // recurring goals: monthly amount, prorated to the period length
  if (goal.isRecurring) {
    if (period.kind === "monthly") return goal.amount;
    return Math.ceil((goal.amount * days * 12) / 365);
  }

  const remaining = goal.amount - goal.amountSaved;
  if (remaining <= 0) return 0;
  // due within this period: everything left is needed now
  if (daysBetween(goal.dueDate, period.end) >= 0) return remaining;
  const periodsRemaining = Math.max(1, Math.ceil(inclusiveDays(period.start, goal.dueDate) / days));
  return Math.ceil(remaining / periodsRemaining);
}

// fund in strict priority order; stops at the first goal the pool can't cover
export function fundInPriorityOrder(
  items: readonly GoalAllocation[],
  pool: Cents,
): { funded: GoalAllocation[]; ignored: Goal[]; remaining: Cents } {
  const funded: GoalAllocation[] = [];
  const ignored: Goal[] = [];
  let remaining = pool;
  let exhausted = false;

  // walk goals until one doesn't fit, then ignore the rest
  for (const item of items) {
    if (!exhausted && item.amount <= remaining) {
      remaining -= item.amount;
      funded.push(item);
    } else {
      exhausted = true;
      ignored.push(item.goal);
    }
  }
  return { funded, ignored, remaining };
}

// record a contribution: caps one-time goals at their target and marks them complete
export function applyContribution(goal: Goal, amount: Cents, now: Date): Goal {
  // recurring goals track the contribution date only
  if (goal.isRecurring) return { ...goal, lastContributionAt: startOfDay(now) };
  const saved = Math.min(goal.amountSaved + amount, goal.amount);
  return {
    ...goal,
    amountSaved: Math.max(saved, 0),
    isCompleted: saved >= goal.amount,
    lastContributionAt: startOfDay(now),
  };
}
