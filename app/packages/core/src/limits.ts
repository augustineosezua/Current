import { daysBetween, startOfDay } from "./dates";
import type { Goal } from "./goals";
import type { TermPlan } from "./termPlan";

// what the free app includes; Plus (2.4) lifts both
export const FREE_LIMITS = { goals: 3, activeTermPlans: 1 } as const;

// a plan still counts until its last day has passed
export function isTermPlanCurrent(plan: TermPlan, now: Date): boolean {
  return plan.isActive && daysBetween(startOfDay(now), plan.endDate) >= 0;
}

// whether another term plan can be added
export function canAddTermPlan(plans: readonly TermPlan[], now: Date, isPlus = false): boolean {
  return isPlus || plans.filter((p) => isTermPlanCurrent(p, now)).length < FREE_LIMITS.activeTermPlans;
}

// whether another goal can be added; finished goals don't count
export function canAddGoal(goals: readonly Goal[], isPlus = false): boolean {
  return isPlus || goals.filter((g) => !g.isCompleted).length < FREE_LIMITS.goals;
}
