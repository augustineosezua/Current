import { describe, expect, it } from "vitest";
import {
  applyWithdrawal,
  getCategoryBudgetStatuses,
  getNeedsWantsSplit,
  getNewBudgetAlerts,
  getRolloverCarry,
  type Category,
  type CategoryBudget,
  type Period,
} from "../src";
import { d, goal, txn } from "./helpers";

const categories: Category[] = [
  { id: "food", name: "Food", kind: "needs" },
  { id: "fun", name: "Fun", kind: "wants" },
  { id: "save", name: "Savings", kind: "savings" },
  { id: "pay", name: "Income", kind: "income" },
];
const jan: Period = { kind: "monthly", start: d(2027, 1, 1), end: d(2027, 1, 31) };
const now = d(2027, 1, 20);
const budget = (over: Partial<CategoryBudget> = {}): CategoryBudget => ({
  categoryId: "food",
  limit: 20_000,
  rollover: false,
  since: d(2026, 10, 1),
  ...over,
});
const ctx = { settings: { budgetPeriod: "monthly" as const }, incomes: [], termPlans: [] };

describe("2.3 category budgets", () => {
  it("adds up spending per category this period, refunds netted off, with what's left", () => {
    const tx = [
      txn({ id: "1", amount: 5_000, categoryId: "food", date: d(2027, 1, 3) }),
      txn({ id: "2", amount: 2_500, categoryId: "food", date: d(2027, 1, 19) }),
      txn({ id: "3", amount: 9_000, categoryId: "food", date: d(2026, 12, 30) }),
      txn({ id: "4", amount: -1_000, categoryId: "food", date: d(2027, 1, 5) }),
    ];
    const [s] = getCategoryBudgetStatuses([budget()], tx, categories, jan, now, ctx);
    expect(s).toMatchObject({ categoryId: "food", limit: 20_000, carry: 0, available: 20_000, spent: 6_500, left: 13_500, threshold: 0 });
  });

  it("refunds inside the period count against spending, never below zero", () => {
    const tx = [txn({ id: "1", amount: 1_000, categoryId: "food" }), txn({ id: "2", amount: -3_000, categoryId: "food" })];
    const [s] = getCategoryBudgetStatuses([budget()], tx, categories, jan, now, ctx);
    expect(s!.spent).toBe(0);
  });

  it("flags 90% and then 100% once spending goes over", () => {
    const at = (amount: number) =>
      getCategoryBudgetStatuses([budget()], [txn({ amount, categoryId: "food" })], categories, jan, now, ctx)[0]!.threshold;
    expect(at(17_999)).toBe(0);
    expect(at(18_000)).toBe(90);
    expect(at(20_000)).toBe(90);
    expect(at(20_001)).toBe(100);
  });

  it("ignores budgets whose category is gone", () => {
    expect(getCategoryBudgetStatuses([budget({ categoryId: "gone" })], [], categories, jan, now, ctx)).toEqual([]);
  });

  it("splits needs and wants, spending and limits", () => {
    const tx = [
      txn({ id: "1", amount: 4_000, categoryId: "food" }),
      txn({ id: "2", amount: 3_000, categoryId: "fun" }),
      txn({ id: "3", amount: 9_000, categoryId: "save" }),
      txn({ id: "4", amount: 500, categoryId: null }),
    ];
    const split = getNeedsWantsSplit(tx, categories, [budget(), budget({ categoryId: "fun", limit: 5_000 })], jan, now);
    expect(split).toEqual({ needs: { spent: 4_000, limit: 20_000 }, wants: { spent: 3_000, limit: 5_000 }, other: 500 });
  });
});

describe("2.3 alerts, once per threshold per period", () => {
  it("returns only thresholds not sent yet", () => {
    const tx = [txn({ amount: 19_000, categoryId: "food" })];
    const statuses = getCategoryBudgetStatuses([budget()], tx, categories, jan, now, ctx);
    const first = getNewBudgetAlerts(statuses, jan, []);
    expect(first).toEqual([{ categoryId: "food", threshold: 90, key: "food:2027-01-01:90", left: 1_000 }]);
    expect(getNewBudgetAlerts(statuses, jan, [first[0]!.key])).toEqual([]);
  });

  it("jumping straight past 100% sends only the 100% alert", () => {
    const statuses = getCategoryBudgetStatuses([budget()], [txn({ amount: 25_000, categoryId: "food" })], categories, jan, now, ctx);
    expect(getNewBudgetAlerts(statuses, jan, []).map((a) => a.threshold)).toEqual([100]);
  });
});

describe("2.12 rollover", () => {
  const tx = [
    txn({ id: "nov", amount: 15_000, categoryId: "food", date: d(2026, 11, 10) }),
    txn({ id: "dec", amount: 26_000, categoryId: "food", date: d(2026, 12, 10) }),
  ];

  it("carries unused budget forward and lets overspending reduce it", () => {
    // Nov: 20,000 - 15,000 = +5,000. Dec: 25,000 - 26,000 = -1,000
    expect(getRolloverCarry(budget({ rollover: true, since: d(2026, 11, 1) }), tx, categories, jan, ctx)).toBe(-1_000);
  });

  it("starts counting from the period it was switched on", () => {
    expect(getRolloverCarry(budget({ rollover: true, since: d(2026, 12, 5) }), tx, categories, jan, ctx)).toBe(-6_000);
  });

  it("is zero when off, and feeds the available amount when on", () => {
    expect(getRolloverCarry(budget({ since: d(2026, 11, 1) }), tx, categories, jan, ctx)).toBe(0);
    const [s] = getCategoryBudgetStatuses([budget({ rollover: true, since: d(2026, 11, 1) })], tx, categories, jan, now, ctx);
    expect(s).toMatchObject({ carry: -1_000, available: 19_000 });
  });
});

describe("2.4 taking money out of a goal", () => {
  it("lowers what's saved, floored at zero, and reopens a finished goal", () => {
    const done = goal({ amount: 30_000, amountSaved: 30_000, isCompleted: true });
    expect(applyWithdrawal(done, 10_000)).toMatchObject({ amountSaved: 20_000, isCompleted: false });
    expect(applyWithdrawal(done, 50_000).amountSaved).toBe(0);
  });
});
