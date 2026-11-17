import { useFocusEffect } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { getVersion, subscribe } from '@/db/live';

export interface QueryState<T> {
  data: T | null;
  error: Error | null;
}

// Reads from the local database on mount, again after every local write, and again when the screen regains focus.
// Writes reload straight away rather than waiting for focus: expo-router's useFocusEffect only re-runs while the
// router reports the screen focused, which left pushed screens (Settings > Budget, Reminders, ...) showing stale
// data until you left and came back. `load` must be stable (module-level or useCallback).
// Pass live = false for forms that should not follow writes made elsewhere.
export function useLiveQuery<T>(load: (db: SQLiteDatabase) => Promise<T>, live = true): QueryState<T> {
  const db = useSQLiteContext();
  const version = useSyncExternalStore(subscribe, getVersion);
  const revision = live ? version : 0;
  const [focusCount, setFocusCount] = useState(0);
  const [state, setState] = useState<QueryState<T>>({ data: null, error: null });

  // every return to this screen re-reads and recalculates as of now (costs one extra local read on mount)
  useFocusEffect(
    useCallback(() => {
      setFocusCount((n) => n + 1);
    }, []),
  );

  // load, ignoring a result that a newer load has overtaken
  useEffect(() => {
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
  }, [db, load, revision, focusCount]);

  return state;
}
