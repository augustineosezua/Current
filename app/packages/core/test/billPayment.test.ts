import { describe, expect, it } from "vitest";
import { planBillPayment } from "../src";
import { bill, d, ymd } from "./helpers";

describe("paying a bill (ROADMAP 1.1)", () => {
  it("logs a transaction for the bill amount with the bill name as merchant", () => {
    const plan = planBillPayment(bill({ id: "rent", name: "Rent", amount: 95_000 }), d(2027, 1, 18));
    expect(plan.transaction).toMatchObject({ amount: 95_000, merchantName: "Rent", billId: "rent", createdFromBill: true });
    expect(ymd(plan.transaction.date)).toBe("2027-01-18");
    expect(plan.nextDueDate).toBeNull();
  });

  it("gives recurring bills their next due date, clamped to month end", () => {
    const plan = planBillPayment(bill({ isRecurring: true, frequency: "monthly", dueDate: d(2027, 1, 31) }), d(2027, 1, 30));
    expect(ymd(plan.nextDueDate)).toBe("2027-02-28");
  });
});
