import { describe, expect, it } from "vitest";
import { applyContribution, fundInPriorityOrder, getGoalContribution, sortGoalsByPriority, type Period } from "../src";
import { d, goal } from "./helpers";

const january: Period = { kind: "monthly", start: d(2027, 1, 1, 0), end: d(2027, 1, 31, 0) };
const paycheque: Period = { kind: "paycheque", start: d(2027, 1, 1, 0), end: d(2027, 1, 14, 0) };

describe("goal contribution per period (STS-steps 4)", () => {
  it("recurring monthly goal contributes its flat amount in a monthly period", () => {
    expect(getGoalContribution(goal({ isRecurring: true, amount: 5_000 }), january)).toBe(5_000);
  });

  it("recurring goal is prorated to a paycheque period", () => {
    // 50.00 a month over 14 days
    expect(getGoalContribution(goal({ isRecurring: true, amount: 5_000 }), paycheque)).toBe(Math.ceil((5_000 * 14 * 12) / 365));
  });

  it("one-time goal spreads what's left over the periods until its due date", () => {
    // Jan 1 to Mar 31 is 3 monthly periods, matching the old (months + 1) rule
    expect(getGoalContribution(goal({ amount: 30_000, amountSaved: 0, dueDate: d(2027, 3, 31) }), january)).toBe(10_000);
    expect(getGoalContribution(goal({ amount: 30_000, amountSaved: 15_000, dueDate: d(2027, 3, 31) }), january)).toBe(5_000);
  });

  it("goal due within the period needs the full remaining amount (less than one period left)", () => {
    expect(getGoalContribution(goal({ amount: 30_000, amountSaved: 10_000, dueDate: d(2027, 1, 20) }), january)).toBe(20_000);
    expect(getGoalContribution(goal({ amount: 30_000, dueDate: d(2026, 12, 1) }), january)).toBe(30_000);
  });

  it("skips completed goals, fully saved goals and goals already funded this period", () => {
    expect(getGoalContribution(goal({ isCompleted: true }), january)).toBe(0);
    expect(getGoalContribution(goal({ amountSaved: 30_000 }), january)).toBe(0);
    expect(getGoalContribution(goal({ lastContributionAt: d(2027, 1, 3) }), january)).toBe(0);
    expect(getGoalContribution(goal({ lastContributionAt: d(2026, 12, 28) }), january)).toBe(10_000);
  });
});

describe("priority allocation", () => {
  it("orders by priority, then soonest due", () => {
    const sorted = sortGoalsByPriority([
      goal({ id: "low", priority: 1 }),
      goal({ id: "high-late", priority: 5, dueDate: d(2027, 6, 1) }),
      goal({ id: "high-soon", priority: 5, dueDate: d(2027, 2, 1) }),
    ]);
    expect(sorted.map((g) => g.id)).toEqual(["high-soon", "high-late", "low"]);
  });

  it("funds highest priority first and stops at the first goal that doesn't fit", () => {
    const a = { goal: goal({ id: "a" }), amount: 100 };
    const b = { goal: goal({ id: "b" }), amount: 300 };
    const c = { goal: goal({ id: "c" }), amount: 50 };
    const r = fundInPriorityOrder([a, b, c], 200);
    expect(r.funded.map((f) => f.goal.id)).toEqual(["a"]);
    expect(r.ignored.map((g) => g.id)).toEqual(["b", "c"]);
    expect(r.remaining).toBe(100);
  });
});

describe("applyContribution", () => {
  it("caps one-time goals at their target and marks them complete", () => {
    const g = applyContribution(goal({ amount: 30_000, amountSaved: 25_000 }), 10_000, d(2027, 1, 10));
    expect(g.amountSaved).toBe(30_000);
    expect(g.isCompleted).toBe(true);
    expect(g.lastContributionAt?.getDate()).toBe(10);
  });

  it("does not mutate the input goal", () => {
    const original = goal();
    applyContribution(original, 1_000, d(2027, 1, 10));
    expect(original.amountSaved).toBe(0);
  });
});
