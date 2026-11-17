// Wording for local notifications. Pure, so vitest can check every line.
import {
  addDays,
  formatMoney,
  formatMoneyWhole,
  BILL_REMINDER_DAYS_BEFORE,
  type Cents,
  type Reminder,
  type WeeklySummary,
} from '@current/core';

import { weekdayLabel } from './format';

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

// "Rent", "Rent and Phone", "Rent, Phone and Gym"
function list(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// the Sunday summary: spent against last week, top categories, the daily number
function summaryBody(f: SummaryFigures): string {
  const { spent, lastWeekSpent } = f.week;
  const parts: string[] = [];
  if (spent === 0) parts.push('Nothing logged this week.');
  else if (lastWeekSpent === 0) parts.push(`Spent ${formatMoneyWhole(spent)} this week.`);
  else if (spent === lastWeekSpent) parts.push(`Spent ${formatMoneyWhole(spent)} this week, the same as last week.`);
  else {
    const gap = formatMoneyWhole(Math.abs(spent - lastWeekSpent));
    parts.push(`Spent ${formatMoneyWhole(spent)} this week, ${gap} ${spent < lastWeekSpent ? 'less' : 'more'} than last week.`);
  }
  if (f.topCategoryNames.length > 0) parts.push(`Mostly ${list(f.topCategoryNames)}.`);
  parts.push(`${formatMoneyWhole(f.perDay)}/day until ${weekdayLabel(f.periodEnd)}.`);
  return parts.join(' ');
}

// title and body for one planned reminder; a summary with no figures yet gets a plain invitation
export function reminderContent(reminder: Reminder, summary: SummaryFigures | null = null): ReminderContent {
  if (reminder.kind === 'bill') {
    const due = weekdayLabel(addDays(reminder.date, BILL_REMINDER_DAYS_BEFORE));
    const [first] = reminder.bills;
    if (reminder.bills.length === 1 && first) {
      return { title: `${first.name} is due ${due}`, body: `${formatMoney(first.amount)}. It's already set aside in your daily number.` };
    }
    const total = reminder.bills.reduce((sum, b) => sum + b.amount, 0);
    return {
      title: `${reminder.bills.length} bills due ${due}`,
      body: `${list(reminder.bills.map((b) => b.name))}: ${formatMoney(total)} in all. Already set aside in your daily number.`,
    };
  }
  if (reminder.kind === 'checkIn') {
    return { title: 'Quick balance check?', body: "It's been over a week. Ten seconds keeps your daily number honest." };
  }
  return { title: 'Your week', body: summary ? summaryBody(summary) : 'Open Current to see how your week went.' };
}
