import { daysBetween, inclusiveDays, startOfDay } from "./dates";
import type { Cents } from "./money";

export interface TermPlan {
  id: string;
  name: string;
  amount: Cents;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
}

export interface TermPlanSummary {
  totalDays: number;
  daysRemaining: number;
  reserve: Cents;
  released: Cents;
  perWeek: Cents;
  perDay: Cents;
  endDate: Date;
}

// days after `day` still covered by the plan, clamped to [0, totalDays]
function daysRemainingAfter(plan: TermPlan, day: Date): number {
  const total = inclusiveDays(plan.startDate, plan.endDate);
  const left = daysBetween(startOfDay(day), plan.endDate);
  return Math.min(Math.max(left, 0), total);
}

// straight-line reserve for the weeks still to come: amount * daysRemaining / totalDays
export function getTermPlanReserve(plan: TermPlan, now: Date): Cents {
  if (!plan.isActive || plan.amount <= 0) return 0;
  const total = inclusiveDays(plan.startDate, plan.endDate);
  if (total <= 0) return 0;
  // round up so the reserve is never short by a cent
  return Math.ceil((plan.amount * daysRemainingAfter(plan, now)) / total);
}

// total reserve across every active plan
export function getTotalTermReserve(plans: readonly TermPlan[], now: Date): Cents {
  let total = 0;
  for (const plan of plans) total += getTermPlanReserve(plan, now);
  return total;
}

// figures for the term plan card
export function getTermPlanSummary(plan: TermPlan, now: Date): TermPlanSummary {
  const totalDays = Math.max(inclusiveDays(plan.startDate, plan.endDate), 1);
  const reserve = getTermPlanReserve(plan, now);
  return {
    totalDays,
    daysRemaining: daysRemainingAfter(plan, now),
    reserve,
    released: plan.amount - reserve,
    perWeek: Math.floor((plan.amount * 7) / totalDays),
    perDay: Math.floor(plan.amount / totalDays),
    endDate: startOfDay(plan.endDate),
  };
}
