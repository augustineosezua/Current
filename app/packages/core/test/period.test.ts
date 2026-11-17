import { describe, expect, it } from "vitest";
import { defaultBudgetPeriod, getCurrentPeriod } from "../src";
import { d, income, termPlan, ymd } from "./helpers";

const range = (p: { start: Date; end: Date; kind: string }) => `${p.kind} ${ymd(p.start)}..${ymd(p.end)}`;

describe("budget period", () => {
  it("defaults to paycheque when an income has a next date, otherwise monthly", () => {
    expect(defaultBudgetPeriod([income()], d(2027, 1, 10))).toBe("paycheque");
    expect(defaultBudgetPeriod([], d(2027, 1, 10))).toBe("monthly");
    expect(defaultBudgetPeriod([income({ nextPaymentDate: null })], d(2027, 1, 10))).toBe("monthly");
  });

  it("monthly is the calendar month", () => {
    expect(range(getCurrentPeriod({ budgetPeriod: "monthly" }, [], [], d(2027, 2, 10)))).toBe("monthly 2027-02-01..2027-02-28");
  });

  it("paycheque runs from the last income date to the day before the next", () => {
    const p = getCurrentPeriod({ budgetPeriod: "paycheque" }, [income({ nextPaymentDate: d(2027, 1, 15) })], [], d(2027, 1, 10));
    expect(range(p)).toBe("paycheque 2027-01-01..2027-01-14");
  });

  it("uses the default when no setting is chosen", () => {
    expect(getCurrentPeriod({}, [income()], [], d(2027, 1, 10)).kind).toBe("paycheque");
  });

  it("term uses the active term plan's dates", () => {
    expect(range(getCurrentPeriod({ budgetPeriod: "term" }, [], [termPlan()], d(2027, 2, 1)))).toBe("term 2027-01-06..2027-04-30");
  });

  it("falls back to monthly when the chosen kind has no data", () => {
    expect(getCurrentPeriod({ budgetPeriod: "term" }, [], [termPlan({ isActive: false })], d(2027, 2, 1)).kind).toBe("monthly");
    expect(getCurrentPeriod({ budgetPeriod: "paycheque" }, [], [], d(2027, 2, 1)).kind).toBe("monthly");
  });
});
