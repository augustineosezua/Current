import { addDays, daysBetween, startOfDay } from "./dates";
import type { Cents } from "./money";
import { occurrence, type Frequency } from "./recurrence";
import type { Transaction } from "./types";

export interface Bill {
  id: string;
  name: string;
  amount: Cents;
  dueDate: Date;
  isPaid: boolean;
  isRecurring: boolean;
  frequency: Frequency | null;
  // intended day of month when the stored due date was clamped (e.g. 31)
  anchorDay?: number;
}

export type BillStatus = "overdue" | "upcoming" | "paid";

// due date of the next occurrence for a recurring bill
export function getNextBillOccurrence(bill: Bill): Date | null {
  if (!bill.isRecurring || !bill.frequency || bill.frequency === "one_time") return null;
  return occurrence(bill.dueDate, bill.frequency, 1, bill.anchorDay ?? bill.dueDate.getDate());
}

export interface BillPaymentPlan {
  // the transaction that marking the bill paid logs
  transaction: { amount: Cents; date: Date; merchantName: string; billId: string; createdFromBill: true };
  // due date of the occurrence to create next, for recurring bills
  nextDueDate: Date | null;
}

// what marking a bill paid on a given day should write
export function planBillPayment(bill: Bill, paidOn: Date): BillPaymentPlan {
  return {
    transaction: { amount: bill.amount, date: startOfDay(paidOn), merchantName: bill.name, billId: bill.id, createdFromBill: true },
    nextDueDate: getNextBillOccurrence(bill),
  };
}

// overdue when unpaid and due before today
export function getBillStatus(bill: Bill, now: Date): BillStatus {
  if (bill.isPaid) return "paid";
  return daysBetween(startOfDay(now), bill.dueDate) < 0 ? "overdue" : "upcoming";
}

// unpaid bills due on or before the cutoff, overdue ones always included
export function getBillsDueBy(bills: readonly Bill[], cutoff: Date): Bill[] {
  return bills.filter((b) => !b.isPaid && daysBetween(b.dueDate, cutoff) >= 0);
}

// overdue first, then by due date
export function sortBillsForDisplay(bills: readonly Bill[], now: Date): Bill[] {
  const rank = (b: Bill) => ({ overdue: 0, upcoming: 1, paid: 2 })[getBillStatus(b, now)];
  return [...bills].sort((a, b) => rank(a) - rank(b) || a.dueDate.getTime() - b.dueDate.getTime());
}

export interface BillMatchSuggestion {
  billId: string;
  transactionId: string;
}

const MATCH_WINDOW_DAYS = 3;
const MATCH_AMOUNT_TOLERANCE: Cents = 100;

// suggest bill/transaction pairs by name and amount near the due date; never auto-confirms
export function suggestBillMatches(bills: readonly Bill[], transactions: readonly Transaction[]): BillMatchSuggestion[] {
  const suggestions: BillMatchSuggestion[] = [];

  // first matching transaction per unpaid bill
  for (const bill of bills) {
    if (bill.isPaid || !bill.name) continue;
    const from = addDays(bill.dueDate, -MATCH_WINDOW_DAYS);
    const to = addDays(bill.dueDate, MATCH_WINDOW_DAYS);
    const billName = bill.name.toLowerCase();

    const match = transactions.find(
      (t) =>
        !!t.merchantName &&
        daysBetween(from, t.date) >= 0 &&
        daysBetween(t.date, to) >= 0 &&
        t.merchantName.toLowerCase().includes(billName) &&
        Math.abs(t.amount - bill.amount) < MATCH_AMOUNT_TOLERANCE,
    );
    if (match) suggestions.push({ billId: bill.id, transactionId: match.id });
  }
  return suggestions;
}
