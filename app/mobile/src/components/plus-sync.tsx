import { calculateSafeToSpend, getNewBudgetAlerts } from '@current/core';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useSyncExternalStore } from 'react';

import { getVersion, subscribe } from '@/db/live';
import { saveSetting } from '@/db/plan';
import * as repo from '@/db/repo';
import { loadStsInput } from '@/db/sts';
import { useLiveQuery } from '@/hooks/use-live-query';
import { budgetAlertContent, budgetStatuses } from '@/lib/budget-status';
import { initPurchases, setDevPlus, usePlus } from '@/lib/plus';
import { getReminderPermission } from '@/lib/reminders';
import { applyTheme } from '@/lib/themes';

const SETTLE_MS = 1500;

// announce category limits crossing 90% or 100%, once per threshold per period (2.3)
async function syncBudgetAlerts(db: Parameters<typeof loadStsInput>[0], now = new Date()): Promise<void> {
  const input = await loadStsInput(db);
  if (input.categoryBudgets.length === 0) return;
  const result = calculateSafeToSpend(input, now);
  const statuses = budgetStatuses(input, result, now);
  const alerts = getNewBudgetAlerts(statuses, result.period, input.settings.budgetAlertsSent);
  if (alerts.length === 0) return;

  if ((await getReminderPermission()) === 'granted') {
    for (const alert of alerts) {
      const status = statuses.find((s) => s.categoryId === alert.categoryId)!;
      await Notifications.scheduleNotificationAsync({ content: budgetAlertContent(status, input, result), trigger: null });
    }
  }
  // remember this period's alerts only; older periods' keys can go
  const periodKey = alerts[0]!.key.split(':')[1]!;
  const kept = input.settings.budgetAlertsSent.filter((k) => k.split(':')[1] === periodKey);
  await saveSetting(db, 'budgetAlertsSent', [...kept, ...alerts.map((a) => a.key)]);
}

// everything Plus needs running in the background: purchases, the theme, the dev switch, limit alerts and
// opening the recap from the Sunday notification
export function PlusSync() {
  const db = useSQLiteContext();
  const isPlus = usePlus();
  const { data: settings } = useLiveQuery(repo.getSettings);
  const version = useSyncExternalStore(subscribe, getVersion);

  useEffect(() => {
    initPurchases();
  }, []);

  // the theme follows the setting, and quietly falls back to the default if Plus lapses
  useEffect(() => {
    if (!settings) return;
    setDevPlus(settings.devPlus);
    applyTheme(settings.theme, isPlus);
  }, [settings, isPlus]);

  // after writes settle, check limits for new alerts
  useEffect(() => {
    if (!isPlus) return;
    const timer = setTimeout(() => {
      syncBudgetAlerts(db).catch(() => {});
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [db, version, isPlus]);

  // a notification carrying a url (the Sunday recap) opens that screen
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
    });
    return () => sub.remove();
  }, []);

  return null;
}
