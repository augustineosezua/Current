import { calculateSafeToSpend, getWeeklySummary, planReminders, DEFAULT_REMINDER_SETTINGS, type Reminder } from '@current/core';
import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';

import { loadStsInput, type BudgetData } from '@/db/sts';

import { isPlusNow } from './plus';
import { reminderContent, type SummaryFigures } from './reminder-text';

// local hour each kind of reminder is shown at
const HOURS: Record<Reminder['kind'], number> = { bill: 9, checkIn: 9, summary: 18 };

export type ReminderPermission = 'granted' | 'ask' | 'denied';

// whether notifications are allowed, can still be asked for, or were turned down
export async function getReminderPermission(): Promise<ReminderPermission> {
  const status = await Notifications.getPermissionsAsync();
  if (status.granted) return 'granted';
  return status.canAskAgain ? 'ask' : 'denied';
}

// show the system prompt (once; iOS never shows it twice) and report where that leaves us
export async function requestReminderPermission(): Promise<ReminderPermission> {
  const status = await Notifications.requestPermissionsAsync();
  if (status.granted) return 'granted';
  return status.canAskAgain ? 'ask' : 'denied';
}

// figures for a Sunday summary as things stand now: this week's spending and that day's daily number
function summaryFigures(input: BudgetData, sunday: Date): SummaryFigures {
  const week = getWeeklySummary(input.transactions, input.categories, sunday);
  const names = new Map(input.categories.map((c) => [c.id, c.name]));
  const sts = calculateSafeToSpend(input, sunday);
  return {
    week,
    topCategoryNames: week.topCategories.flatMap((c) => (c.categoryId && names.get(c.categoryId)) || []),
    perDay: sts.daily.perDay,
    periodEnd: sts.daily.periodEnd,
  };
}

// Replace every scheduled notification with the current plan. Called after each local write, so what is
// scheduled always matches the data; the plan itself (core) guarantees at most one a day.
export async function syncReminders(db: SQLiteDatabase, now = new Date()): Promise<void> {
  if ((await getReminderPermission()) !== 'granted') return;
  const input = await loadStsInput(db);
  const settings = { ...DEFAULT_REMINDER_SETTINGS, ...input.settings.reminders };
  const plan = planReminders({ bills: input.bills, accounts: input.accounts, settings }, now);

  await Notifications.cancelAllScheduledNotificationsAsync();
  let summarized = false;

  // one dated notification per planned reminder; only the nearest summary carries figures, later ones are refreshed by then
  for (const reminder of plan) {
    const date = new Date(reminder.date.getFullYear(), reminder.date.getMonth(), reminder.date.getDate(), HOURS[reminder.kind]);
    if (date.getTime() <= now.getTime()) continue;
    const figures = reminder.kind === 'summary' && !summarized ? summaryFigures(input, reminder.date) : null;
    if (reminder.kind === 'summary') summarized = true;
    // 2.10: for Plus, the Sunday summary opens the written recap
    const link = reminder.kind === 'summary' && isPlusNow() ? { data: { url: '/recap' } } : {};
    await Notifications.scheduleNotificationAsync({
      content: { ...reminderContent(reminder, figures), ...link },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  }
}
