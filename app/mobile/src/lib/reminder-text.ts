// Wording for local notifications. Pure, so vitest can check every line.
import { addDays, BILL_REMINDER_DAYS_BEFORE, type Cents, type Reminder, type WeeklySummary } from '@current/core';

import { t } from '../i18n';
import { listLabel, money, moneyWhole, untilLabel, weekdayLabel } from './format';

export interface ReminderContent {
  title: string;
  body: string;
}

export interface SummaryFigures {
  week: WeeklySummary;
  // names for the week's top categories, in order; uncategorized ones are left out
  topCategoryNames: string[];
  perDay: Cents;
  periodEnd: Date;
}

// the Sunday summary: spent against last week, top categories, the daily number
function summaryBody(f: SummaryFigures): string {
  const { spent, lastWeekSpent } = f.week;
  const amount = moneyWhole(spent);
  const parts: string[] = [];
  if (spent === 0) parts.push(t('notify.weekNothing'));
  else if (lastWeekSpent === 0) parts.push(t('notify.weekSpent', { amount }));
  else if (spent === lastWeekSpent) parts.push(t('notify.weekSame', { amount }));
  else {
    const gap = moneyWhole(Math.abs(spent - lastWeekSpent));
    parts.push(t(spent < lastWeekSpent ? 'notify.weekLess' : 'notify.weekMore', { amount, gap }));
  }
  if (f.topCategoryNames.length > 0) parts.push(t('notify.weekMostly', { categories: listLabel(f.topCategoryNames) }));
  parts.push(t('notify.weekPerDay', { amount: moneyWhole(f.perDay), date: untilLabel(f.periodEnd) }));
  return parts.join(' ');
}

// title and body for one planned reminder; a summary with no figures yet gets a plain invitation
export function reminderContent(reminder: Reminder, summary: SummaryFigures | null = null): ReminderContent {
  if (reminder.kind === 'bill') {
    const day = weekdayLabel(addDays(reminder.date, BILL_REMINDER_DAYS_BEFORE));
    const [first] = reminder.bills;
    if (reminder.bills.length === 1 && first) {
      return { title: t('notify.billOne', { bill: first.name, day }), body: t('notify.billOneBody', { amount: money(first.amount) }) };
    }
    const total = reminder.bills.reduce((sum, b) => sum + b.amount, 0);
    return {
      title: t('notify.billMany', { count: reminder.bills.length, day }),
      body: t('notify.billManyBody', { names: listLabel(reminder.bills.map((b) => b.name)), amount: money(total) }),
    };
  }
  if (reminder.kind === 'checkIn') return { title: t('notify.checkIn'), body: t('notify.checkInBody') };
  return { title: t('notify.week'), body: summary ? summaryBody(summary) : t('notify.weekLater') };
}
