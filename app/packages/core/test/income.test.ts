import { describe, expect, it } from "vitest";
import { getNextIncome, getNextPaymentDate, getPreviousPaymentDate } from "../src";
import { d, income, ymd } from "./helpers";

describe("getNextPaymentDate", () => {
  it("returns a future date unchanged", () => {
    expect(ymd(getNextPaymentDate(income({ nextPaymentDate: d(2027, 1, 15) }), d(2027, 1, 10)))).toBe("2027-01-15");
  });

  it("returns null without a date", () => {
    expect(getNextPaymentDate(income({ nextPaymentDate: null }), d(2027, 1, 10))).toBeNull();
  });

  it("rolls a stale date forward lazily by frequency (STS-steps 5)", () => {
    const now = d(2027, 2, 1);
    expect(ymd(getNextPaymentDate(income({ frequency: "weekly", nextPaymentDate: d(2027, 1, 1) }), now))).toBe("2027-02-05");
    expect(ymd(getNextPaymentDate(income({ frequency: "biweekly", nextPaymentDate: d(2027, 1, 1) }), now))).toBe("2027-02-12");
    expect(ymd(getNextPaymentDate(income({ frequency: "daily", nextPaymentDate: d(2027, 1, 1) }), now))).toBe("2027-02-02");
    expect(ymd(getNextPaymentDate(income({ frequency: "yearly", nextPaymentDate: d(2026, 9, 1) }), now))).toBe("2027-09-01");
  });

  it("treats a payday today as received", () => {
    expect(ymd(getNextPaymentDate(income({ frequency: "weekly", nextPaymentDate: d(2027, 1, 8) }), d(2027, 1, 8, 9)))).toBe(
      "2027-01-15",
    );
  });

  it("does not mutate its input", () => {
    const i = income({ frequency: "weekly", nextPaymentDate: d(2027, 1, 1) });
    getNextPaymentDate(i, d(2027, 3, 1));
    expect(ymd(i.nextPaymentDate)).toBe("2027-01-01");
  });

  it("clamps monthly pay on the 31st to the month's last day without drifting", () => {
    const i = income({ frequency: "monthly", nextPaymentDate: d(2027, 1, 31) });
    expect(ymd(getNextPaymentDate(i, d(2027, 2, 1)))).toBe("2027-02-28");
    expect(ymd(getNextPaymentDate(i, d(2027, 3, 1)))).toBe("2027-03-31");
    expect(ymd(getNextPaymentDate(i, d(2027, 4, 1)))).toBe("2027-04-30");
  });

  it("honours an explicit anchor day when the stored date was already clamped", () => {
    const i = income({ frequency: "monthly", nextPaymentDate: d(2027, 2, 28), anchorDay: 31 });
    expect(ymd(getNextPaymentDate(i, d(2027, 3, 1)))).toBe("2027-03-31");
  });

  it("clamps the 29th and 30th in February, including leap years", () => {
    expect(ymd(getNextPaymentDate(income({ frequency: "monthly", nextPaymentDate: d(2027, 1, 30) }), d(2027, 2, 1)))).toBe(
      "2027-02-28",
    );
    expect(ymd(getNextPaymentDate(income({ frequency: "monthly", nextPaymentDate: d(2028, 1, 29) }), d(2028, 2, 1)))).toBe(
      "2028-02-29",
    );
    expect(ymd(getNextPaymentDate(income({ frequency: "yearly", nextPaymentDate: d(2028, 2, 29) }), d(2028, 3, 1)))).toBe(
      "2029-02-28",
    );
  });

  it("alternates semimonthly pay between the 1st and 15th", () => {
    const i = income({ frequency: "semimonthly", nextPaymentDate: d(2027, 1, 1) });
    expect(ymd(getNextPaymentDate(i, d(2027, 1, 3)))).toBe("2027-01-15");
    expect(ymd(getNextPaymentDate(i, d(2027, 1, 20)))).toBe("2027-02-01");
  });

  it("returns null for one-time income in the past", () => {
    expect(getNextPaymentDate(income({ frequency: "one_time", nextPaymentDate: d(2027, 1, 1) }), d(2027, 1, 5))).toBeNull();
  });
});

describe("getPreviousPaymentDate", () => {
  it("finds the last payday on or before today", () => {
    const i = income({ frequency: "biweekly", nextPaymentDate: d(2027, 1, 15) });
    expect(ymd(getPreviousPaymentDate(i, d(2027, 1, 10)))).toBe("2027-01-01");
    expect(ymd(getPreviousPaymentDate(i, d(2027, 1, 15)))).toBe("2027-01-15");
  });

  it("steps back semimonthly", () => {
    const i = income({ frequency: "semimonthly", nextPaymentDate: d(2027, 2, 1) });
    expect(ymd(getPreviousPaymentDate(i, d(2027, 1, 20)))).toBe("2027-01-15");
    expect(ymd(getPreviousPaymentDate(i, d(2027, 1, 10)))).toBe("2027-01-01");
  });
});

describe("getNextIncome", () => {
  it("picks the soonest payday across incomes", () => {
    const next = getNextIncome(
      [income({ id: "a", nextPaymentDate: d(2027, 1, 20) }), income({ id: "b", nextPaymentDate: d(2027, 1, 12) })],
      d(2027, 1, 10),
    );
    expect(next?.income.id).toBe("b");
  });
});
