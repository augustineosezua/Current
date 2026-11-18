import { describe, expect, it } from "vitest";
import { checkAfford, getIncomeBetween } from "../src";
import { bill, chequing, d, income, stsInput, termPlan, ymd } from "./helpers";

// Sunday Jan 10, monthly budget: 22 days left including today
const now = d(2027, 1, 10);

describe("2.2 can I afford this?", () => {
  it("says yes when it fits today and leaves a comfortable daily number", () => {
    const r = checkAfford(stsInput({ accounts: [chequing(100_000)] }), 4_000, now);
    expect(r.verdict).toBe("yes");
    expect(r.perDayNow).toBe(Math.floor(100_000 / 22));
    expect(r.newPerDay).toBe(Math.floor(96_000 / 22));
    expect(r.waitUntil).toBeNull();
  });

  it("says tight when it fits but the daily number drops under the tight line", () => {
    const r = checkAfford(stsInput({ accounts: [chequing(40_000)] }), 20_000, now);
    expect(r.verdict).toBe("tight");
    expect(r.newPerDay).toBe(Math.floor(20_000 / 22));
  });

  it("says tight when it takes everything", () => {
    const r = checkAfford(stsInput({ accounts: [chequing(40_000)] }), 40_000, now);
    expect(r).toMatchObject({ verdict: "tight", newPerDay: 0 });
  });

  it("says wait until the next payday when it only fits after", () => {
    const input = stsInput({
      accounts: [chequing(10_000)],
      incomes: [income({ amount: 50_000, frequency: "monthly", nextPaymentDate: d(2027, 1, 15) })],
    });
    const r = checkAfford(input, 30_000, now);
    expect(r.verdict).toBe("wait");
    expect(ymd(r.waitUntil)).toBe("2027-01-15");
    expect(r.reason).toBe("payday");
  });

  it("keeps counting bills as it looks ahead, including later rounds of recurring ones", () => {
    const input = stsInput({
      accounts: [chequing(10_000)],
      incomes: [income({ amount: 100_000, frequency: "monthly", nextPaymentDate: d(2027, 1, 15) })],
      bills: [bill({ amount: 90_000, dueDate: d(2027, 1, 20), isRecurring: true, frequency: "monthly" })],
    });
    // after the 15th: 110,000 - 90,000 = 20,000, so 30,000 can't fit then; Feb 15 adds 100,000 but Feb 20 rent counts too
    const r = checkAfford(input, 30_000, now);
    expect(ymd(r.waitUntil)).toBe("2027-02-15");
  });

  it("waits for semester money to unlock", () => {
    const input = stsInput({
      accounts: [chequing(400_000)],
      termPlans: [termPlan({ amount: 400_000, startDate: d(2027, 1, 6), endDate: d(2027, 4, 30) })],
      settings: { budgetPeriod: "term", minimumMonthlySpend: 0 },
    });
    const r = checkAfford(input, 30_000, now);
    expect(r.verdict).toBe("wait");
    expect(r.reason).toBe("semester-money");
    expect(r.waitUntil).not.toBeNull();
  });

  it("says wait with no date when nothing in sight covers it", () => {
    const r = checkAfford(stsInput({ accounts: [chequing(1_000)] }), 500_000, now);
    expect(r).toMatchObject({ verdict: "wait", waitUntil: null, reason: "not-in-sight" });
  });

  it("refuses a non-positive or fractional amount", () => {
    expect(() => checkAfford(stsInput(), 0, now)).toThrow();
    expect(() => checkAfford(stsInput(), 1.5, now)).toThrow();
  });
});

describe("income between two days", () => {
  it("adds every payday after `from`, up to and including `to`", () => {
    const incomes = [income({ amount: 100, frequency: "weekly", nextPaymentDate: d(2027, 1, 12) })];
    expect(getIncomeBetween(incomes, d(2027, 1, 10), d(2027, 1, 26))).toBe(300);
    expect(getIncomeBetween(incomes, d(2027, 1, 12), d(2027, 1, 18))).toBe(0);
  });
});
