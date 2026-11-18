// Dates, money and repeated labels in the app's language. No Expo imports, so vitest can load it.
import { daysBetween, formatMoney, formatMoneyWhole, type BudgetPeriodKind, type Cents, type Frequency } from '@current/core';

import { CURRENCY, LANGUAGE, LOCALE, t, type MessageKey } from '../i18n';

const short = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', month: 'short', day: 'numeric' });
const monthYear = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' });
const monthDay = new Intl.DateTimeFormat(LOCALE, { month: 'short', day: 'numeric' });
const weekdayLong = new Intl.DateTimeFormat(LOCALE, { weekday: 'long' });
const fullDate = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', month: 'short', day: 'numeric' });

// money in the app's locale and currency, e.g. "$4.50" or "4,50 $"
export function money(cents: Cents): string {
  return formatMoney(cents, LOCALE, CURRENCY);
}

// whole dollars, rounded down, for headline numbers
export function moneyWhole(cents: Cents): string {
  return formatMoneyWhole(cents, LOCALE, CURRENCY);
}

// "Fri, Jan 8"
export function shortDate(date: Date): string {
  return short.format(date);
}

// "January 2027"
export function monthLabel(date: Date): string {
  const label = monthYear.format(date);
  return label[0]!.toUpperCase() + label.slice(1);
}

// "Today", "Yesterday", "Tomorrow", otherwise the short date
export function dayLabel(date: Date, now = new Date()): string {
  const ago = daysBetween(date, now);
  if (ago === 0) return t('common.today');
  if (ago === 1) return t('common.yesterday');
  if (ago === -1) return t('common.tomorrow');
  return short.format(date);
}

// "Jan 2", for ranges and card lines
export function monthDayLabel(date: Date): string {
  return monthDay.format(date);
}

// "Friday"
export function weekdayLabel(date: Date): string {
  return weekdayLong.format(date);
}

// "Friday, Jan 8" ("vendredi 8 janv." in French): where the daily number runs until, so it's never ambiguous which Friday
export function untilLabel(date: Date): string {
  return LANGUAGE === 'fr' ? fullDate.format(date).replace(',', '') : `${weekdayLong.format(date)}, ${monthDay.format(date)}`;
}

// what one budget period is called in a sentence: "paycheque", "month", "semester"
export function periodNoun(kind: BudgetPeriodKind): string {
  return t(`period.${kind}` as MessageKey);
}

// the period with the words around it: "This month", "this month", "last month", "the next month"
export function periodPhrase(kind: BudgetPeriodKind, which: 'this' | 'thisLower' | 'last' | 'next'): string {
  const prefix = { this: 'periodThis', thisLower: 'periodThisLower', last: 'periodLast', next: 'periodNext' }[which];
  return t(`${prefix}.${kind}` as MessageKey);
}

// "today", "yesterday" or "9 days ago"
export function daysAgoLabel(date: Date, now = new Date()): string {
  const ago = daysBetween(date, now);
  if (ago <= 0) return t('common.todayLower');
  return ago === 1 ? t('common.yesterdayLower') : t('common.daysAgo', { count: ago });
}

// chip label for how often something repeats
export function frequencyLabel(frequency: Frequency): string {
  return t(`freq.${frequency}` as MessageKey);
}

// "Rent", "Rent and Phone", "Rent, Phone and Gym"
export function listLabel(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return t('list.and', { first: names.slice(0, -1).join(', '), last: names[names.length - 1]! });
}
