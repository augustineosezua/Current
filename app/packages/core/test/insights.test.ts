import { describe, expect, it } from "vitest";
import { compareCategories, cumulative, getDailySpending, getMonthlyTotals, getTopMerchants, getWeekdayAverages, getWeeklyRecap, getWeeklyTotals, previousRange, type Category } from "../src";
import { chequing, d, stsInput, txn, ymd } from "./helpers";

const categories: Category[] = [
  { id: "food", name: "Food", kind: "needs" },
  { id: "fun", name: "Fun", kind: "wants" },
  { id: "save", name: "Savings", kind: "savings" },
];

describe("2.8 insights", () => {
  const tx = [
    txn({ id: "1", amount: 1_000, categoryId: "food", date: d(2027, 1, 4) }),
    txn({ id: "2", amount: 2_000, categoryId: "food", date: d(2027, 1, 4) }),
    txn({ id: "3", amount: 500, categoryId: "fun", date: d(2027, 1, 6) }),
    txn({ id: "4", amount: 9_000, categoryId: "save", date: d(2027, 1, 6) }),
    txn({ id: "5", amount: 4_000, categoryId: "fun", date: d(2026, 12, 29) }),
  ];

  it("gives every day in the range, zero when nothing was spent", () => {
    const days = getDailySpending(tx, categories, d(2027, 1, 3), d(2027, 1, 6));
    expect(days.map((x) => [ymd(x.date), x.amount])).toEqual([
      ["2027-01-03", 0],
      ["2027-01-04", 3_000],
      ["2027-01-05", 0],
      ["2027-01-06", 500],
    ]);
  });

  it("totals the last 8 Monday-to-Sunday weeks, oldest first, ending with this week", () => {
    const weeks = getWeeklyTotals(tx, categories, d(2027, 1, 7), 8);
    expect(weeks).toHaveLength(8);
    expect(ymd(weeks[7]!.start)).toBe("2027-01-04");
    expect(ymd(weeks[7]!.end)).toBe("2027-01-10");
    expect(weeks[7]!.amount).toBe(3_500);
    expect(weeks[6]!.amount).toBe(4_000);
    expect(ymd(weeks[0]!.start)).toBe("2026-11-16");
  });

  it("the previous range is the same length, right before", () => {
    const prev = previousRange({ start: d(2027, 1, 4), end: d(2027, 1, 10) });
    expect([ymd(prev.start), ymd(prev.end)]).toEqual(["2026-12-28", "2027-01-03"]);
  });

  it("compares categories like for like, biggest spend first", () => {
    const rows = compareCategories(tx, categories, { start: d(2027, 1, 4), end: d(2027, 1, 10) }, previousRange({ start: d(2027, 1, 4), end: d(2027, 1, 10) }));
    expect(rows).toEqual([
      { categoryId: "food", amount: 3_000, previous: 0, change: 3_000, changePercent: null },
      { categoryId: "fun", amount: 500, previous: 4_000, change: -3_500, changePercent: -87 },
    ]);
  });
});

describe("2.10 weekly recap", () => {
  const tx = [
    txn({ id: "1", amount: 3_000, categoryId: "food", date: d(2027, 1, 5) }),
    txn({ id: "2", amount: 1_000, categoryId: "fun", date: d(2027, 1, 9) }),
    txn({ id: "3", amount: 500, categoryId: "food", date: d(2026, 12, 30) }),
    txn({ id: "4", amount: 6_000, categoryId: "fun", date: d(2026, 12, 31) }),
  ];
  const input = stsInput({ accounts: [chequing(50_000)], transactions: tx, categories });

  it("on a Sunday, covers the week ending today", () => {
    const r = getWeeklyRecap(input, d(2027, 1, 10));
    expect([ymd(r.start), ymd(r.end)]).toEqual(["2027-01-04", "2027-01-10"]);
    expect(r).toMatchObject({ spent: 4_000, lastWeekSpent: 6_500, change: -2_500 });
    expect(r.topCategories.map((c) => c.categoryId)).toEqual(["food", "fun"]);
    expect(r.biggestChange).toMatchObject({ categoryId: "fun", amount: 1_000, previous: 6_000, change: -5_000 });
  });

  it("midweek, covers the last full week", () => {
    const r = getWeeklyRecap(input, d(2027, 1, 13));
    expect([ymd(r.start), ymd(r.end)]).toEqual(["2027-01-04", "2027-01-10"]);
  });

  it("includes today's daily number", () => {
    const r = getWeeklyRecap(input, d(2027, 1, 10));
    expect(r.perDay).toBe(Math.floor(50_000 / 22));
    expect(ymd(r.periodEnd)).toBe("2027-01-31");
  });
});

describe("2.8 insights charts", () => {
  const cats: Category[] = [
    { id: "food", name: "Food", kind: "needs" },
    { id: "save", name: "Savings", kind: "savings" },
  ];
  const tx = [
    txn({ id: "a", amount: 1_000, categoryId: "food", merchantName: "Tim Hortons", date: d(2027, 1, 4) }), // Monday
    txn({ id: "b", amount: 600, categoryId: "food", merchantName: "tim  hortons", date: d(2027, 1, 11) }), // Monday
    txn({ id: "c", amount: 2_500, categoryId: "food", merchantName: "Metro", date: d(2027, 1, 9) }), // Saturday
    txn({ id: "d", amount: 9_000, categoryId: "save", merchantName: "Savings", date: d(2027, 1, 9) }),
    txn({ id: "e", amount: 4_000, categoryId: "food", date: d(2026, 12, 15) }),
  ];

  it("keeps a running total", () => {
    expect(cumulative([{ date: d(2027, 1, 1), amount: 100 }, { date: d(2027, 1, 2), amount: 0 }, { date: d(2027, 1, 3), amount: 50 }])).toEqual([100, 100, 150]);
  });

  it("totals calendar months, oldest first, this month so far", () => {
    const months = getMonthlyTotals(tx, cats, d(2027, 1, 12), 3);
    expect(months.map((m) => [ymd(m.start), ymd(m.end), m.amount])).toEqual([
      ["2026-11-01", "2026-11-30", 0],
      ["2026-12-01", "2026-12-31", 4_000],
      ["2027-01-01", "2027-01-12", 4_100],
    ]);
  });

  it("averages each weekday over how often it comes up, Monday first", () => {
    const days = getWeekdayAverages(tx, cats, { start: d(2027, 1, 4), end: d(2027, 1, 17) });
    expect(days[0]).toEqual({ weekday: 0, total: 1_600, average: 800 });
    expect(days[5]).toEqual({ weekday: 5, total: 2_500, average: 1_250 });
    expect(days[6]!.total).toBe(0);
  });

  it("ranks merchants by spend, matching names loosely and skipping savings", () => {
    expect(getTopMerchants(tx, cats, { start: d(2027, 1, 1), end: d(2027, 1, 31) })).toEqual([
      { name: "Metro", amount: 2_500, count: 1 },
      { name: "Tim Hortons", amount: 1_600, count: 2 },
    ]);
  });
});
