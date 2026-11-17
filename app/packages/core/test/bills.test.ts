import { describe, expect, it } from "vitest";
import { getBillStatus, getBillsDueBy, getNextBillOccurrence, sortBillsForDisplay, suggestBillMatches } from "../src";
import { bill, d, txn, ymd } from "./helpers";

describe("bill recurrence", () => {
  it("advances by frequency", () => {
    expect(ymd(getNextBillOccurrence(bill({ isRecurring: true, frequency: "weekly", dueDate: d(2027, 1, 1) })))).toBe("2027-01-08");
    expect(ymd(getNextBillOccurrence(bill({ isRecurring: true, frequency: "biweekly", dueDate: d(2027, 1, 1) })))).toBe("2027-01-15");
    expect(ymd(getNextBillOccurrence(bill({ isRecurring: true, frequency: "yearly", dueDate: d(2027, 1, 1) })))).toBe("2028-01-01");
    expect(ymd(getNextBillOccurrence(bill({ isRecurring: true, frequency: "semimonthly", dueDate: d(2027, 1, 15) })))).toBe(
      "2027-02-01",
    );
  });

  it("clamps monthly bills on the 31st to the month's last day", () => {
    expect(ymd(getNextBillOccurrence(bill({ isRecurring: true, frequency: "monthly", dueDate: d(2027, 1, 31) })))).toBe("2027-02-28");
    expect(
      ymd(getNextBillOccurrence(bill({ isRecurring: true, frequency: "monthly", dueDate: d(2027, 2, 28), anchorDay: 31 }))),
    ).toBe("2027-03-31");
  });

  it("has no next occurrence for one-time bills", () => {
    expect(getNextBillOccurrence(bill())).toBeNull();
  });
});

describe("bill status (STS-steps 2: overdue vs upcoming flag)", () => {
  it("flags unpaid bills due before today as overdue", () => {
    expect(getBillStatus(bill({ dueDate: d(2027, 1, 5) }), d(2027, 1, 10))).toBe("overdue");
    expect(getBillStatus(bill({ dueDate: d(2027, 1, 10, 0) }), d(2027, 1, 10, 18))).toBe("upcoming");
    expect(getBillStatus(bill({ dueDate: d(2027, 1, 5), isPaid: true }), d(2027, 1, 10))).toBe("paid");
  });

  it("lists overdue bills first", () => {
    const sorted = sortBillsForDisplay(
      [bill({ id: "later", dueDate: d(2027, 1, 25) }), bill({ id: "late", dueDate: d(2027, 1, 2) }), bill({ id: "soon", dueDate: d(2027, 1, 12) })],
      d(2027, 1, 10),
    );
    expect(sorted.map((b) => b.id)).toEqual(["late", "soon", "later"]);
  });

  it("includes overdue unpaid bills when collecting bills due by a cutoff", () => {
    const due = getBillsDueBy(
      [bill({ id: "late", dueDate: d(2026, 11, 1) }), bill({ id: "paid", isPaid: true }), bill({ id: "far", dueDate: d(2027, 3, 1) })],
      d(2027, 1, 31),
    );
    expect(due.map((b) => b.id)).toEqual(["late"]);
  });
});

describe("bill matching (STS-steps 7)", () => {
  const rent = bill({ name: "Rent", amount: 100_000, dueDate: d(2027, 1, 20) });

  it("matches on name and an amount within $1, within 3 days of the due date", () => {
    expect(suggestBillMatches([rent], [txn({ id: "t", merchantName: "RENT PAYMENT", amount: 100_050, date: d(2027, 1, 22) })])).toEqual([
      { billId: "b1", transactionId: "t" },
    ]);
  });

  it("rejects amounts $1 or more apart", () => {
    expect(suggestBillMatches([rent], [txn({ merchantName: "Rent", amount: 100_100, date: d(2027, 1, 20) })])).toEqual([]);
  });

  it("rejects dates more than 3 days away", () => {
    expect(suggestBillMatches([rent], [txn({ merchantName: "Rent", amount: 100_000, date: d(2027, 1, 24) })])).toEqual([]);
  });

  it("only suggests for unpaid bills", () => {
    expect(suggestBillMatches([{ ...rent, isPaid: true }], [txn({ merchantName: "Rent", amount: 100_000, date: d(2027, 1, 20) })])).toEqual(
      [],
    );
  });
});
