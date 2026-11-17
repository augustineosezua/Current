import { describe, expect, it } from "vitest";
import { calculateSafeToSpend, ABOVE_STS_PRIORITY } from "../src";
import { bill, chequing, d, goal, income, savings, stsInput, termPlan, txn, ymd } from "./helpers";

// mid-January, monthly budgeting unless a test says otherwise
const now = d(2027, 1, 10);

describe("STS-steps 4: Safe-to-Spend calculation", () => {
  it("sums balances across non-savings accounts (chequing and cash)", () => {
    const r = calculateSafeToSpend(
      stsInput({ accounts: [chequing(100_000), { id: "cash", type: "cash", balance: 5_000 }, savings(900_000)] }),
      now,
    );
    expect(r.breakdown.spendableBalance).toBe(105_000);
    expect(r.safeToSpend).toBe(105_000);
  });

  it("counts unpaid bills due this period plus overdue unpaid bills, not paid ones", () => {
    const r = calculateSafeToSpend(
      stsInput({
        accounts: [chequing(200_000)],
        bills: [
          bill({ id: "rent", amount: 100_000, dueDate: d(2027, 1, 20) }),
          bill({ id: "late", amount: 5_000, dueDate: d(2026, 11, 15) }),
          bill({ id: "paid", amount: 7_000, dueDate: d(2027, 1, 12), isPaid: true }),
          bill({ id: "next-month", amount: 9_000, dueDate: d(2027, 2, 20) }),
        ],
      }),
      now,
    );
    expect(r.billsCounted.map((b) => b.id).sort()).toEqual(["late", "rent"]);
    expect(r.breakdown.billsTotal).toBe(105_000);
    expect(r.safeToSpend).toBe(95_000);
  });

  it("bill cutoff is max(period end, now + 7 days)", () => {
    const bills = [bill({ id: "in7", dueDate: d(2027, 2, 3) }), bill({ id: "beyond", dueDate: d(2027, 2, 10) })];
    const r = calculateSafeToSpend(stsInput({ accounts: [chequing(500_000)], bills }), d(2027, 1, 28));
    expect(r.billsCounted.map((b) => b.id)).toEqual(["in7"]);
  });

  it("uses the paycheque period end for the bill cutoff", () => {
    const bills = [bill({ id: "in7", dueDate: d(2027, 1, 16) }), bill({ id: "after", dueDate: d(2027, 1, 20) })];
    const r = calculateSafeToSpend(
      stsInput({
        accounts: [chequing(500_000)],
        bills,
        incomes: [income({ nextPaymentDate: d(2027, 1, 15) })],
        settings: { budgetPeriod: "paycheque", minimumMonthlySpend: 0 },
      }),
      now,
    );
    expect(ymd(r.period.end)).toBe("2027-01-14");
    expect(r.billsCounted.map((b) => b.id)).toEqual(["in7"]);
  });

  it("deducts this period's goal contributions in priority order", () => {
    const r = calculateSafeToSpend(
      stsInput({
        accounts: [chequing(200_000)],
        bills: [bill({ amount: 100_000 })],
        goals: [goal({ id: "laptop", amount: 30_000, dueDate: d(2027, 3, 31) })],
      }),
      now,
    );
    expect(r.goals.funded.map((g) => [g.goal.id, g.amount])).toEqual([["laptop", 10_000]]);
    expect(r.breakdown.committedGoals).toBe(10_000);
    expect(r.safeToSpend).toBe(90_000);
  });

  it("funds the higher priority goal when only one fits", () => {
    const r = calculateSafeToSpend(
      stsInput({
        accounts: [chequing(115_000)],
        bills: [bill({ amount: 100_000 })],
        goals: [
          goal({ id: "low", priority: 1, amount: 30_000 }),
          goal({ id: "high", priority: 5, amount: 30_000 }),
        ],
      }),
      now,
    );
    expect(r.goals.funded.map((g) => g.goal.id)).toEqual(["high"]);
    expect(r.goals.ignored.map((g) => g.id)).toEqual(["low"]);
    expect(r.safeToSpend).toBe(5_000);
  });

  it("protects the spending floor before goals", () => {
    const settings = { budgetPeriod: "monthly" as const, minimumMonthlySpend: 50_000 };
    const goals = [goal({ id: "a", priority: 2 }), goal({ id: "b", priority: 1 })];

    // can't cover the floor: no goals, STS is what's left
    const short = calculateSafeToSpend(stsInput({ accounts: [chequing(130_000)], bills: [bill()], goals, settings }), now);
    expect(short.goals.funded).toEqual([]);
    expect(short.safeToSpend).toBe(30_000);

    // floor covered, one goal fits: STS is the floor plus the leftover
    const partial = calculateSafeToSpend(stsInput({ accounts: [chequing(165_000)], bills: [bill()], goals, settings }), now);
    expect(partial.goals.funded.map((g) => g.goal.id)).toEqual(["a"]);
    expect(partial.safeToSpend).toBe(55_000);
  });

  it("shrinks the floor by what's been spent this period, ignoring bill, savings and income transactions", () => {
    const r = calculateSafeToSpend(
      stsInput({
        accounts: [chequing(100_000)],
        categories: [
          { id: "food", name: "Food", kind: "wants" },
          { id: "save", name: "Savings", kind: "savings" },
        ],
        transactions: [
          txn({ id: "1", amount: 20_000, date: d(2027, 1, 5), categoryId: "food" }),
          txn({ id: "2", amount: 10_000, date: d(2027, 1, 6), categoryId: "save" }),
          txn({ id: "3", amount: 40_000, date: d(2027, 1, 7), createdFromBill: true }),
          txn({ id: "4", amount: 5_000, date: d(2026, 12, 30), categoryId: "food" }),
          txn({ id: "5", amount: -90_000, date: d(2027, 1, 2), categoryId: null }),
        ],
        settings: { budgetPeriod: "monthly", minimumMonthlySpend: 50_000 },
      }),
      now,
    );
    expect(r.breakdown.spendingFloor).toBe(30_000);
  });

  it("prorates the spending floor to the period length", () => {
    const r = calculateSafeToSpend(
      stsInput({
        accounts: [chequing(100_000)],
        incomes: [income({ nextPaymentDate: d(2027, 1, 15) })],
        settings: { budgetPeriod: "paycheque", minimumMonthlySpend: 50_000 },
      }),
      now,
    );
    // 14-day paycheque period
    expect(r.breakdown.spendingFloor).toBe(Math.round((50_000 * 14 * 12) / 365));
  });

  it("flows leftover back into STS when everything is funded", () => {
    const r = calculateSafeToSpend(
      stsInput({
        accounts: [chequing(500_000)],
        bills: [bill()],
        goals: [goal()],
        settings: { budgetPeriod: "monthly", minimumMonthlySpend: 50_000 },
      }),
      now,
    );
    expect(r.safeToSpend).toBe(500_000 - 100_000 - 10_000);
  });

  it("floors STS at 0", () => {
    const r = calculateSafeToSpend(stsInput({ accounts: [chequing(50_000)], bills: [bill()] }), now);
    expect(r.safeToSpend).toBe(0);
  });

  it("deducts explicit above-STS goals in full and treats below-STS goals as funded from STS", () => {
    const r = calculateSafeToSpend(
      stsInput({
        accounts: [chequing(150_000)],
        bills: [bill()],
        goals: [goal({ id: "above", priority: ABOVE_STS_PRIORITY }), goal({ id: "below", priority: 1 })],
      }),
      now,
    );
    expect(r.breakdown.committedGoals).toBe(10_000);
    expect(r.safeToSpend).toBe(40_000);
    expect(r.goals.fromSts.map((g) => g.goal.id)).toEqual(["below"]);
  });

  it("returns integer cents everywhere", () => {
    const r = calculateSafeToSpend(
      stsInput({
        accounts: [chequing(123_457)],
        bills: [bill({ amount: 33_333 })],
        goals: [goal({ amount: 10_001, isRecurring: true })],
        incomes: [income()],
        termPlans: [termPlan({ amount: 333_333 })],
        settings: { budgetPeriod: "paycheque", minimumMonthlySpend: 12_345 },
      }),
      now,
    );
    const values = [r.safeToSpend, r.daily.perDay, ...Object.values(r.breakdown), ...r.goals.funded.map((g) => g.amount)];
    for (const v of values) expect(Number.isInteger(v)).toBe(true);
  });
});

describe("STS-steps 5: available after next paycheque", () => {
  it("triggers when bills can't be covered", () => {
    const r = calculateSafeToSpend(
      stsInput({
        accounts: [chequing(50_000)],
        bills: [bill()],
        goals: [goal()],
        incomes: [income({ amount: 120_000, nextPaymentDate: d(2027, 1, 15) })],
      }),
      now,
    );
    expect(r.safeToSpend).toBe(0);
    // 500 + 1,200 - 1,000 bills - 100 goal
    expect(r.availableAfter).toEqual({ amount: 60_000, date: d(2027, 1, 15, 0) });
  });

  it("triggers when STS reaches 0 from goals alone (missing in the old code)", () => {
    const r = calculateSafeToSpend(
      stsInput({
        accounts: [chequing(110_000)],
        bills: [bill()],
        goals: [goal()],
        incomes: [income({ nextPaymentDate: d(2027, 1, 15) })],
      }),
      now,
    );
    expect(r.safeToSpend).toBe(0);
    expect(r.availableAfter?.amount).toBe(120_000);
  });

  it("triggers when explicit above-STS goals exhaust STS", () => {
    const r = calculateSafeToSpend(
      stsInput({
        accounts: [chequing(105_000)],
        bills: [bill()],
        goals: [goal({ priority: ABOVE_STS_PRIORITY })],
        incomes: [income({ nextPaymentDate: d(2027, 1, 15) })],
      }),
      now,
    );
    expect(r.safeToSpend).toBe(0);
    expect(r.availableAfter).not.toBeNull();
  });

  it("does not trigger when STS is above 0", () => {
    const r = calculateSafeToSpend(stsInput({ accounts: [chequing(500_000)], incomes: [income()] }), now);
    expect(r.availableAfter).toBeNull();
  });

  it("rolls a stale paycheque date forward lazily, without mutating the input", () => {
    const stale = income({ frequency: "biweekly", nextPaymentDate: d(2026, 12, 18) });
    const r = calculateSafeToSpend(stsInput({ accounts: [chequing(0)], bills: [bill()], incomes: [stale] }), now);
    expect(ymd(r.availableAfter?.date)).toBe("2027-01-15");
    expect(ymd(stale.nextPaymentDate)).toBe("2026-12-18");
  });

  it("floors the available-after amount at 0", () => {
    const r = calculateSafeToSpend(
      stsInput({ accounts: [chequing(0)], bills: [bill({ amount: 500_000 })], incomes: [income({ amount: 100_000 })] }),
      now,
    );
    expect(r.availableAfter?.amount).toBe(0);
  });

  it("is null without any income", () => {
    const r = calculateSafeToSpend(stsInput({ accounts: [chequing(0)], bills: [bill()] }), now);
    expect(r.availableAfter).toBeNull();
  });
});

describe("term plans in STS (roadmap 0.8 acceptance)", () => {
  // $4,000 term plan, Jan 6 to Apr 30, nothing else
  const input = stsInput({ accounts: [chequing(400_000)], termPlans: [termPlan()] });

  it("STS on day 1 is about $35", () => {
    const r = calculateSafeToSpend(input, d(2027, 1, 6));
    expect(r.safeToSpend).toBeGreaterThanOrEqual(3_400);
    expect(r.safeToSpend).toBeLessThanOrEqual(3_600);
  });

  it("grows by about $35 a day", () => {
    const day1 = calculateSafeToSpend(input, d(2027, 1, 6)).safeToSpend;
    const day2 = calculateSafeToSpend(input, d(2027, 1, 7)).safeToSpend;
    const day30 = calculateSafeToSpend(input, d(2027, 2, 4)).safeToSpend;
    expect(Math.abs(day2 - day1 - 3_478)).toBeLessThanOrEqual(1);
    expect(Math.abs(day30 - 30 * 3_478)).toBeLessThanOrEqual(30);
  });

  it("shows the reserve in the breakdown", () => {
    const r = calculateSafeToSpend(input, d(2027, 1, 6));
    expect(r.breakdown.termReserve + r.safeToSpend).toBe(400_000);
  });
});

describe("daily Safe-to-Spend", () => {
  it("divides STS by the days left in the period, today included", () => {
    const r = calculateSafeToSpend(stsInput({ accounts: [chequing(220_000)] }), now);
    // Jan 10 to Jan 31 is 22 days
    expect(r.daily.daysLeft).toBe(22);
    expect(r.daily.perDay).toBe(10_000);
    expect(ymd(r.daily.periodEnd)).toBe("2027-01-31");
  });

  it("never divides by less than 1", () => {
    const r = calculateSafeToSpend(stsInput({ accounts: [chequing(10_000)] }), d(2027, 1, 31));
    expect(r.daily.daysLeft).toBe(1);
    expect(r.daily.perDay).toBe(10_000);
  });

  it("counts term money released before the period ends, so a term period gives about $35/day", () => {
    const termInput = stsInput({
      accounts: [chequing(400_000)],
      termPlans: [termPlan()],
      settings: { budgetPeriod: "term", minimumMonthlySpend: 0 },
    });
    const term = calculateSafeToSpend(termInput, d(2027, 1, 6));
    expect(term.daily.daysLeft).toBe(115);
    expect(term.daily.perDay).toBe(3_478);

    const monthly = calculateSafeToSpend({ ...termInput, settings: { budgetPeriod: "monthly", minimumMonthlySpend: 0 } }, d(2027, 1, 6));
    expect(Math.abs(monthly.daily.perDay - 3_478)).toBeLessThanOrEqual(1);
  });
});
