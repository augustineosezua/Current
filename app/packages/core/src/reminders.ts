import type { Bill } from "./bills";
import { CHECK_IN_STALE_AFTER_DAYS } from "./checkIn";
import { addDays, daysBetween, startOfDay } from "./dates";
import type { Account } from "./types";

export const BILL_REMINDER_DAYS_BEFORE = 3;
const DEFAULT_HORIZON_DAYS = 28;

export interface ReminderSettings {
  bills: boolean;
  summary: boolean;
  checkIn: boolean;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = { bills: true, summary: true, checkIn: true };

export type Reminder =
  // one or more bills due 3 days after `date`
  | { kind: "bill"; date: Date; bills: Bill[] }
  // the spendable balance hasn't been checked for over a week
  | { kind: "checkIn"; date: Date; accountId: string }
  // the Sunday summary
  | { kind: "summary"; date: Date };

const RANK: Record<Reminder["kind"], number> = { bill: 0, checkIn: 1, summary: 2 };

// which local notification to show on which day, from today through the horizon; never more than one a day
export function planReminders(
  input: { bills: readonly Bill[]; accounts: readonly Account[]; settings: ReminderSettings },
  now: Date,
  horizonDays = DEFAULT_HORIZON_DAYS,
): Reminder[] {
  const today = startOfDay(now);
  const inHorizon = (date: Date) => {
    const offset = daysBetween(today, date);
    return offset >= 0 && offset <= horizonDays;
  };
  const candidates: Reminder[] = [];

  // unpaid bills, grouped by the day their reminder falls on
  if (input.settings.bills) {
    const byDay = new Map<number, Bill[]>();
    for (const bill of input.bills) {
      if (bill.isPaid) continue;
      const date = addDays(bill.dueDate, -BILL_REMINDER_DAYS_BEFORE);
      if (!inHorizon(date)) continue;
      byDay.set(date.getTime(), [...(byDay.get(date.getTime()) ?? []), bill]);
    }
    for (const [time, bills] of byDay) candidates.push({ kind: "bill", date: new Date(time), bills });
  }

  // the first day the oldest check-in turns stale, then weekly while it stays unchecked
  if (input.settings.checkIn) {
    let oldest: { at: Date; accountId: string } | null = null;
    for (const a of input.accounts) {
      if (a.type === "savings" || !a.lastCheckInAt) continue;
      if (!oldest || a.lastCheckInAt.getTime() < oldest.at.getTime()) oldest = { at: a.lastCheckInAt, accountId: a.id };
    }
    if (oldest) {
      let date = addDays(oldest.at, CHECK_IN_STALE_AFTER_DAYS + 1);
      // already stale: start tomorrow rather than in the past
      if (daysBetween(today, date) < 0) date = addDays(today, 1);
      for (; inHorizon(date); date = addDays(date, 7)) candidates.push({ kind: "checkIn", date, accountId: oldest.accountId });
    }
  }

  // every Sunday
  if (input.settings.summary) {
    for (let date = addDays(today, (7 - today.getDay()) % 7); inHorizon(date); date = addDays(date, 7)) {
      candidates.push({ kind: "summary", date });
    }
  }

  // one a day: a bill beats a check-in, which beats the summary
  const perDay = new Map<number, Reminder>();
  for (const r of candidates) {
    const existing = perDay.get(r.date.getTime());
    if (!existing || RANK[r.kind] < RANK[existing.kind]) perDay.set(r.date.getTime(), r);
  }
  return [...perDay.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}
