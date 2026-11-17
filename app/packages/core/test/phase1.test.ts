import { describe, expect, it } from "vitest";
import {
  calculateSafeToSpend,
  canAddGoal,
  canAddTermPlan,
  getCurrentPeriod,
  getPreviousPeriod,
  getSpending,
  getWeeklySummary,
  planReminders,
  summarizePeriod,
  transactionsToCsv,
  DEFAULT_REMINDER_SETTINGS,
  type Category,
} from "../src";
import { bill, chequing, d, goal, income, savings, stsInput, termPlan, txn, ymd } from "./helpers";

const categories: Category[] = [
  { id: "food", name: "Food", kind: "needs" },
  { id: "fun", name: "Fun", kind: "wants" },
  { id: "save", name: "Savings", kind: "savings" },
  { id: "pay", name: "Income", kind: "income" },
];

describe("getSpending", () => {
  const transactions = [
    txn({ id: "1", amount: 1_000, categoryId: "food", date: d(2027, 1, 5) }),
    txn({ id: "2", amount: 2_500, categoryId: "fun", date: d(2027, 1, 6) }),
    txn({ id: "3", amount: 700, categoryId: "food", date: d(2027, 1, 7) }),
    txn({ id: "4", amount: 300, categoryId: null, date: d(2027, 1, 7) }),
    txn({ id: "5", amount: 400, categoryId: "gone", date: d(2027, 1, 7) }),
    txn({ id: "6", amount: 5_000, categoryId: "save", date: d(2027, 1, 7) }),
    txn({ id: "7", amount: -90_000, categoryId: "pay", date: d(2027, 1, 7) }),
    txn({ id: "8", amount: 9_999, categoryId: "food", date: d(2027, 1, 20) }),
  ];

  it("adds up money out by category, biggest first", () => {
    const s = getSpending(transactions, categories, d(2027, 1, 1), d(2027, 1, 10));
    expect(s.total).toBe(4_900);
    expect(s.byCategory).toEqual([
      { categoryId: "fun", amount: 2_500 },
      { categoryId: "food", amount: 1_700 },
      { categoryId: null, amount: 700 },
    ]);
  });

  it("leaves out savings moves, income and anything outside the range", () => {
    const s = getSpending(transactions, categories, d(2027, 1, 7), d(2027, 1, 7));
    expect(s.total).toBe(1_400);
  });
});

describe("summarizePeriod", () => {
  const now = d(2027, 2, 10);
  const period = getCurrentPeriod({ budgetPeriod: "monthly" }, [], [], now);

  it("finds the previous period of the same kind", () => {
    const prev = getPreviousPeriod(period, {}, [], []);
    expect([ymd(prev?.start), ymd(prev?.end)]).toEqual(["2027-01-01", "2027-01-31"]);

    const pay = [income({ frequency: "biweekly", nextPaymentDate: d(2027, 2, 12) })];
    const current = getCurrentPeriod({ budgetPeriod: "paycheque" }, pay, [], now);
    const before = getPreviousPeriod(current, {}, pay, []);
    expect([ymd(current.start), ymd(current.end)]).toEqual(["2027-01-29", "2027-02-11"]);
    expect([ymd(before?.start), ymd(before?.end)]).toEqual(["2027-01-15", "2027-01-28"]);
  });

  it("has no previous period for one-off income or a first term", () => {
    const once = [income({ frequency: "one_time", nextPaymentDate: d(2027, 2, 20) })];
    expect(getPreviousPeriod(getCurrentPeriod({ budgetPeriod: "paycheque" }, once, [], now), {}, once, [])).toBeNull();
    const plans = [termPlan()];
    expect(getPreviousPeriod(getCurrentPeriod({ budgetPeriod: "term" }, [], plans, now), {}, [], plans)).toBeNull();
  });

  it("compares day N with day N of the previous period", () => {
    const transactions = [
      txn({ id: "a", amount: 8_800, categoryId: "food", date: d(2027, 2, 3) }),
      txn({ id: "b", amount: 6_000, categoryId: "food", date: d(2027, 1, 4) }),
      txn({ id: "c", amount: 4_000, categoryId: "fun", date: d(2027, 1, 10) }),
      txn({ id: "late", amount: 50_000, categoryId: "fun", date: d(2027, 1, 11) }),
    ];
    const s = summarizePeriod(transactions, categories, period, getPreviousPeriod(period, {}, [], []), now);
    expect(s.total).toBe(8_800);
    expect(s.comparison).toEqual({ dayOfPeriod: 10, previousTotal: 10_000, changePercent: -12 });
  });

  it("gives no percentage when the previous period had no spending", () => {
    const s = summarizePeriod([], categories, period, getPreviousPeriod(period, {}, [], []), now);
    expect(s.comparison?.changePercent).toBeNull();
    expect(summarizePeriod([], categories, period, null, now).comparison).toBeNull();
  });
});

describe("getWeeklySummary", () => {
  it("covers Monday to Sunday and the week before, with the top 3 categories", () => {
    const transactions = [
      txn({ id: "1", amount: 1_000, categoryId: "food", date: d(2027, 1, 11) }),
      txn({ id: "2", amount: 3_000, categoryId: "fun", date: d(2027, 1, 16) }),
      txn({ id: "3", amount: 500, categoryId: null, date: d(2027, 1, 17) }),
      txn({ id: "4", amount: 2_000, categoryId: "food", date: d(2027, 1, 10) }),
      txn({ id: "5", amount: 9_000, categoryId: "food", date: d(2027, 1, 3) }),
    ];
    const s = getWeeklySummary(transactions, categories, d(2027, 1, 17));
    expect([ymd(s.start), ymd(s.end)]).toEqual(["2027-01-11", "2027-01-17"]);
    expect(s.spent).toBe(4_500);
    expect(s.lastWeekSpent).toBe(2_000);
    expect(s.topCategories.map((c) => c.categoryId)).toEqual(["fun", "food", null]);
  });
});

describe("planReminders", () => {
  // Wednesday
  const now = d(2027, 1, 6);
  const account = { ...chequing(10_000), lastCheckInAt: d(2027, 1, 5) };
  const plan = (over: Partial<Parameters<typeof planReminders>[0]> = {}, horizon = 14) =>
    planReminders({ bills: [], accounts: [account], settings: DEFAULT_REMINDER_SETTINGS, ...over }, now, horizon);

  it("reminds 3 days before an unpaid bill, grouping bills due the same day", () => {
    const bills = [
      bill({ id: "rent", dueDate: d(2027, 1, 15) }),
      bill({ id: "phone", dueDate: d(2027, 1, 15) }),
      bill({ id: "paid", dueDate: d(2027, 1, 14), isPaid: true }),
      bill({ id: "soon", dueDate: d(2027, 1, 7) }),
    ];
    const r = plan({ bills, settings: { bills: true, summary: false, checkIn: false } });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ kind: "bill" });
    expect(ymd(r[0]!.date)).toBe("2027-01-12");
    expect(r[0]!.kind === "bill" && r[0]!.bills.map((b) => b.id)).toEqual(["rent", "phone"]);
  });

  it("sends the summary every Sunday", () => {
    const r = plan({ settings: { bills: false, summary: true, checkIn: false } });
    expect(r.map((x) => ymd(x.date))).toEqual(["2027-01-10", "2027-01-17"]);
  });

  it("asks for a check-in the first day the balance is over 7 days old, then weekly", () => {
    const r = plan({ settings: { bills: false, summary: false, checkIn: true } });
    expect(r.map((x) => ymd(x.date))).toEqual(["2027-01-13", "2027-01-20"]);
    const stale = plan({
      accounts: [{ ...account, lastCheckInAt: d(2026, 12, 1) }],
      settings: { bills: false, summary: false, checkIn: true },
    });
    expect(ymd(stale[0]?.date)).toBe("2027-01-07");
  });

  it("ignores savings accounts for check-ins", () => {
    const r = plan({
      accounts: [{ ...savings(5_000), lastCheckInAt: d(2026, 12, 1) }],
      settings: { bills: false, summary: false, checkIn: true },
    });
    expect(r).toEqual([]);
  });

  it("never plans more than one a day, and a bill wins the day", () => {
    const bills = [bill({ id: "rent", dueDate: d(2027, 1, 13) }), bill({ id: "gym", dueDate: d(2027, 1, 16) })];
    const r = plan({ bills });
    const days = r.map((x) => ymd(x.date));
    expect(new Set(days).size).toBe(days.length);
    expect(r.find((x) => ymd(x.date) === "2027-01-10")?.kind).toBe("bill");
    expect(r.find((x) => ymd(x.date) === "2027-01-13")?.kind).toBe("bill");
    expect(r.find((x) => ymd(x.date) === "2027-01-17")?.kind).toBe("summary");
  });

  it("plans nothing with every toggle off", () => {
    expect(plan({ bills: [bill()], settings: { bills: false, summary: false, checkIn: false } })).toEqual([]);
  });
});

describe("transactionsToCsv", () => {
  it("writes one row per transaction with money out as negative", () => {
    const csv = transactionsToCsv(
      [
        { ...txn({ amount: 450, categoryId: "food", date: d(2027, 1, 5) }), accountId: "chq", note: null },
        { ...txn({ amount: -120_000, merchantName: "Paycheque", categoryId: "pay", date: d(2027, 1, 1) }), accountId: "chq" },
        txn({ amount: 5, merchantName: null, categoryId: "gone" }),
      ],
      categories,
      [{ ...chequing(0), name: "Chequing" }],
    );
    expect(csv.split("\r\n")).toEqual([
      "Date,Amount,Merchant,Category,Account,Note",
      "2027-01-05,-4.50,Tim Hortons,Food,Chequing,",
      "2027-01-01,1200.00,Paycheque,Income,Chequing,",
      "2027-01-10,-0.05,,,,",
      "",
    ]);
  });

  it("quotes commas and quotes, and defuses formulas", () => {
    const csv = transactionsToCsv(
      [{ ...txn({ merchantName: 'Joe\'s "Diner", Main St', categoryId: null }), note: "=SUM(A1)" }],
      [],
      [],
    );
    expect(csv.split("\r\n")[1]).toBe('2027-01-10,-10.00,"Joe\'s ""Diner"", Main St",,,\'=SUM(A1)');
  });
});

describe("free limits", () => {
  const now = d(2027, 2, 1);

  it("allows one current term plan", () => {
    expect(canAddTermPlan([], now)).toBe(true);
    expect(canAddTermPlan([termPlan()], now)).toBe(false);
    expect(canAddTermPlan([termPlan({ endDate: d(2027, 1, 31) })], now)).toBe(true);
    expect(canAddTermPlan([termPlan({ isActive: false })], now)).toBe(true);
    expect(canAddTermPlan([termPlan()], now, true)).toBe(true);
  });

  it("allows three unfinished goals", () => {
    expect(canAddGoal([goal(), goal({ id: "g2" })])).toBe(true);
    expect(canAddGoal([goal(), goal({ id: "g2" }), goal({ id: "g3" })])).toBe(false);
    expect(canAddGoal([goal(), goal({ id: "g2" }), goal({ id: "g3", isCompleted: true })])).toBe(true);
  });
});

describe("daily number breakdown", () => {
  it("reports the period total behind the daily number and the bill cutoff", () => {
    const now = d(2027, 1, 10);
    const r = calculateSafeToSpend(stsInput({ accounts: [chequing(220_000)] }), now);
    expect(r.daily.total).toBe(220_000);
    expect(r.daily.perDay).toBe(Math.floor(r.daily.total / r.daily.daysLeft));
    expect(ymd(r.billsCutoff)).toBe("2027-01-31");

    const term = calculateSafeToSpend(
      stsInput({ accounts: [chequing(400_000)], termPlans: [termPlan()], settings: { budgetPeriod: "term", minimumMonthlySpend: 0 } }),
      d(2027, 1, 6),
    );
    expect(term.daily.total).toBe(400_000);
    expect(term.safeToSpend).toBeLessThan(term.daily.total);
  });
});
