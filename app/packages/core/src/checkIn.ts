import { daysBetween, startOfDay } from "./dates";
import { assertCents, type Cents } from "./money";
import type { Account } from "./types";

// a manual balance older than this is flagged next to Safe-to-Spend
export const CHECK_IN_STALE_AFTER_DAYS = 7;

// how far the real balance is from the calculated one: entered minus calculated
export function getBalanceDrift(calculated: Cents, entered: Cents): Cents {
  return assertCents(entered, "entered balance") - assertCents(calculated, "calculated balance");
}

// amount of the transaction that explains a drift (positive = money out)
export function getDriftTransactionAmount(drift: Cents): Cents {
  return drift === 0 ? 0 : -drift;
}

export interface CheckInStaleness {
  days: number;
  accountId: string;
}

// the spendable account checked longest ago, when that was over 7 days back
export function getCheckInStaleness(accounts: readonly Account[], now: Date): CheckInStaleness | null {
  const today = startOfDay(now);
  let oldest: CheckInStaleness | null = null;

  // savings never feed Safe-to-Spend, so only chequing and cash count
  for (const a of accounts) {
    if (a.type === "savings" || !a.lastCheckInAt) continue;
    const days = daysBetween(a.lastCheckInAt, today);
    if (!oldest || days > oldest.days) oldest = { days, accountId: a.id };
  }
  return oldest && oldest.days > CHECK_IN_STALE_AFTER_DAYS ? oldest : null;
}
