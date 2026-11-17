import { useFocusEffect } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState, useSyncExternalStore } from 'react';

import { getVersion, subscribe } from '@/db/live';

export interface QueryState<T> {
  data: T | null;
  error: Error | null;
}

// Reads from the local database when the screen gains focus and again after every write.
// `load` must be stable (module-level or useCallback). Pass live = false for forms that should read once.
export function useLiveQuery<T>(load: (db: SQLiteDatabase) => Promise<T>, live = true): QueryState<T> {
  const db = useSQLiteContext();
  const version = useSyncExternalStore(subscribe, getVersion);
  const revision = live ? version : 0;
  const [state, setState] = useState<QueryState<T>>({ data: null, error: null });

  // reload, ignoring results from a screen that has since blurred
  useFocusEffect(
    useCallback(() => {
      void revision;
      let active = true;
      load(db)
        .then((data) => {
          if (active) setState({ data, error: null });
        })
        .catch((e: unknown) => {
          if (active) setState({ data: null, error: e instanceof Error ? e : new Error(String(e)) });
        });
      return () => {
        active = false;
      };
    }, [db, load, revision]),
  );

  return state;
}
