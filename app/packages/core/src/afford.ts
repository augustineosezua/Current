// 2.2 "Can I afford this?": does an amount fit today's Safe-to-Spend, or once the next paycheque or
// semester money arrives, and what does it do to the daily number. Code decides; the model only explains.
import type { Bill } from "./bills";
import { addDays, daysBetween, startOfDay } from "./dates";
import { getNextPaymentDate, type Income } from "./income";
import { assertCents, type Cents } from "./money";
import { TIGHT_BELOW_PER_DAY } from "./mood";
import { occurrence } from "./recurrence";
import { calculateSafeToSpend, type StsInput, type StsResult } from "./sts";
import { getTotalTermReserve } from "./termPlan";
import type { Account } from "./types";

export type AffordVerdict = "yes" | "tight" | "wait";

// why the answer is what it is, for the copy and the explanation
export type AffordReason = "fits" | "fits-tight" | "payday" | "semester-money" | "later" | "not-in-sight";

export interface AffordResult {
  verdict: AffordVerdict;
  reason: AffordReason;
  amount: Cents;
  safeToSpend: Cents;
  perDayNow: Cents;
  // the daily number after buying it: today when it fits, otherwise on `waitUntil`
  newPerDay: Cents;
  // the day it would fit, or null when it fits now or nothing in sight covers it
  waitUntil: Date | null;
  // last day the daily number runs to, on the day of purchase
  periodEnd: Date;
}

export interface AffordOptions {
  tightBelowPerDay?: Cents;
  // how many days ahead to look for a day it fits
  horizonDays?: number;
}

const DEFAULT_HORIZON_DAYS = 120;
// recurring bills are expanded this far past the day being checked, beyond any bills cutoff
const BILL_EXPANSION_DAYS = 62;

// total pay landing after `from` and on or before `to`
export function getIncomeBetween(incomes: readonly Income[], from: Date, to: Date): Cents {
  let total = 0;
  for (const income of incomes) {
    // step from payday to payday until past `to`
    for (let date = getNextPaymentDate(income, from); date && daysBetween(date, to) >= 0; date = getNextPaymentDate(income, date)) {
      total += income.amount;
    }
  }
  return total;
}

// stored bills plus the later rounds of recurring ones, which only get rows once the earlier round is paid
function expandBills(bills: readonly Bill[], through: Date): Bill[] {
  const out: Bill[] = [...bills];
  for (const bill of bills) {
    if (bill.isPaid || !bill.isRecurring || !bill.frequency || bill.frequency === "one_time") continue;
    const anchorDay = bill.anchorDay ?? bill.dueDate.getDate();
    for (let k = 1; ; k++) {
      const due = occurrence(bill.dueDate, bill.frequency, k, anchorDay);
      if (!due || daysBetween(due, through) < 0) break;
      out.push({ ...bill, id: `${bill.id}#${k}`, dueDate: due });
    }
  }
  return out;
}

// the budget as it would stand on `day` if pay arrives as planned and nothing else changes
function projectOnto(input: StsInput, today: Date, day: Date): StsResult {
  const pay = getIncomeBetween(input.incomes, today, day);
  let accounts: Account[] = [...input.accounts];
  if (pay > 0) {
    const index = accounts.findIndex((a) => a.type !== "savings");
    if (index >= 0) accounts[index] = { ...accounts[index]!, balance: accounts[index]!.balance + pay };
    else accounts = [...accounts, { id: "projected-pay", type: "chequing", balance: pay }];
  }
  const bills = expandBills(input.bills, addDays(day, BILL_EXPANSION_DAYS));
  return calculateSafeToSpend({ ...input, accounts, bills }, day);
}

// daily number left after spending `amount` out of a result's period total
function perDayAfter(result: StsResult, amount: Cents): Cents {
  return Math.max(0, Math.floor((result.daily.total - amount) / result.daily.daysLeft));
}

// whether `amount` fits now, later, or not in sight, and the daily number it leaves
export function checkAfford(input: StsInput, amount: Cents, now: Date, options: AffordOptions = {}): AffordResult {
  assertCents(amount, "amount");
  if (amount <= 0) throw new Error("amount must be above zero");
  const tight = options.tightBelowPerDay ?? TIGHT_BELOW_PER_DAY;
  const today = startOfDay(now);
  const current = calculateSafeToSpend(input, now);
  const base = { amount, safeToSpend: current.safeToSpend, perDayNow: current.daily.perDay };

  // fits today: yes, or tight when the daily number left is under the tight line
  if (amount <= current.safeToSpend) {
    const newPerDay = perDayAfter(current, amount);
    const comfortable = newPerDay >= tight;
    return {
      ...base,
      verdict: comfortable ? "yes" : "tight",
      reason: comfortable ? "fits" : "fits-tight",
      newPerDay,
      waitUntil: null,
      periodEnd: current.daily.periodEnd,
    };
  }

  // look ahead day by day for the first day it fits
  const reserveNow = getTotalTermReserve(input.termPlans, now);
  for (let i = 1; i <= (options.horizonDays ?? DEFAULT_HORIZON_DAYS); i++) {
    const day = addDays(today, i);
    const projected = projectOnto(input, today, day);
    if (amount > projected.safeToSpend) continue;
    const paidThatDay = getIncomeBetween(input.incomes, addDays(day, -1), day) > 0;
    const termUnlocked = getTotalTermReserve(input.termPlans, day) < reserveNow;
    return {
      ...base,
      verdict: "wait",
      reason: paidThatDay ? "payday" : termUnlocked ? "semester-money" : "later",
      newPerDay: perDayAfter(projected, amount),
      waitUntil: day,
      periodEnd: projected.daily.periodEnd,
    };
  }
  return { ...base, verdict: "wait", reason: "not-in-sight", newPerDay: 0, waitUntil: null, periodEnd: current.daily.periodEnd };
}
