import { daysBetween, type BudgetPeriodKind, type Frequency } from '@current/core';

const short = new Intl.DateTimeFormat('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
const monthYear = new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric' });

// "Fri, Jan 8"
export function shortDate(date: Date): string {
  return short.format(date);
}

// "January 2027"
export function monthLabel(date: Date): string {
  return monthYear.format(date);
}

// "Today", "Yesterday", "Tomorrow", otherwise the short date
export function dayLabel(date: Date, now = new Date()): string {
  const ago = daysBetween(date, now);
  if (ago === 0) return 'Today';
  if (ago === 1) return 'Yesterday';
  if (ago === -1) return 'Tomorrow';
  return short.format(date);
}

// "Jan 2", for ranges and card lines
const monthDay = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' });
export function monthDayLabel(date: Date): string {
  return monthDay.format(date);
}

// "Friday"
const weekdayLong = new Intl.DateTimeFormat('en-CA', { weekday: 'long' });
export function weekdayLabel(date: Date): string {
  return weekdayLong.format(date);
}

// "Friday, Jan 8": where the daily number runs until, so it's never ambiguous which Friday
export function untilLabel(date: Date): string {
  return `${weekdayLong.format(date)}, ${monthDay.format(date)}`;
}

// what one budget period is called in a sentence
export const PERIOD_NOUNS: Record<BudgetPeriodKind, string> = { paycheque: 'paycheque', monthly: 'month', term: 'semester' };

// "today", "yesterday" or "9 days ago"
export function daysAgoLabel(date: Date, now = new Date()): string {
  const ago = daysBetween(date, now);
  if (ago <= 0) return 'today';
  return ago === 1 ? 'yesterday' : `${ago} days ago`;
}

// chip labels for how often something repeats
export const FREQUENCY_LABELS: Record<Frequency, string> = {
  one_time: 'Just once',
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  semimonthly: '1st and 15th',
  monthly: 'Monthly',
  yearly: 'Yearly',
};
