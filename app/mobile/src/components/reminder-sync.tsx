import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useSyncExternalStore } from 'react';

import { getVersion, subscribe } from '@/db/live';
import { syncReminders } from '@/lib/reminders';

const SETTLE_MS = 1500;

// keeps scheduled notifications in step with the data: on launch and shortly after every local write
export function ReminderSync() {
  const db = useSQLiteContext();
  const version = useSyncExternalStore(subscribe, getVersion);

  // wait for a burst of writes to settle; a failed sync is retried by the next write or launch
  useEffect(() => {
    const timer = setTimeout(() => {
      syncReminders(db).catch(() => {});
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [db, version]);

  return null;
}
