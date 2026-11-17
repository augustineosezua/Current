import { describe, expect, it } from "vitest";
import { getTermPlanReserve, getTermPlanSummary } from "../src";
import { d, termPlan } from "./helpers";

describe("term plan reserve = amount * daysRemaining / totalDays", () => {
  // Jan 6 to Apr 30, 2027 is 115 days
  const plan = termPlan();

  it("releases one day's worth on day 1", () => {
    expect(getTermPlanReserve(plan, d(2027, 1, 6))).toBe(Math.ceil((400_000 * 114) / 115));
  });

  it("holds the full amount before the plan starts and nothing after it ends", () => {
    expect(getTermPlanReserve(plan, d(2027, 1, 1))).toBe(400_000);
    expect(getTermPlanReserve(plan, d(2027, 4, 30))).toBe(0);
    expect(getTermPlanReserve(plan, d(2027, 5, 15))).toBe(0);
  });

  it("ignores inactive plans", () => {
    expect(getTermPlanReserve(termPlan({ isActive: false }), d(2027, 2, 1))).toBe(0);
  });

  it("summarizes released, per week and end date for the card", () => {
    const s = getTermPlanSummary(plan, d(2027, 1, 6));
    expect(s.totalDays).toBe(115);
    expect(s.released + s.reserve).toBe(400_000);
    expect(s.perWeek).toBe(Math.floor((400_000 * 7) / 115));
    expect(s.endDate.getMonth()).toBe(3);
  });
});
