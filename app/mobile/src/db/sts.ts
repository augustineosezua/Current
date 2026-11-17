import { calculateSafeToSpend, type StsInput, type StsResult } from '@current/core';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import * as repo from './repo';

// read every table core needs; core does the math, nothing is written back
export async function loadStsInput(db: SQLiteDatabase): Promise<StsInput> {
  const [accounts, bills, goals, incomes, termPlans, transactions, categories, settings] = await Promise.all([
    repo.accounts.list(db),
    repo.bills.list(db),
    repo.goals.list(db),
    repo.incomes.list(db),
    repo.termPlans.list(db),
    repo.transactions.list(db),
    repo.categories.list(db),
    repo.getSettings(db),
  ]);
  return { accounts, bills, goals, incomes, termPlans, transactions, categories, settings };
}

// Safe-to-Spend for the focused screen, recomputed each time it regains focus
export function useSafeToSpend(): { result: StsResult | null; error: Error | null } {
  const db = useSQLiteContext();
  const [result, setResult] = useState<StsResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // reload on focus, ignoring results from a screen that has since blurred
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadStsInput(db)
        .then((input) => {
          if (active) setResult(calculateSafeToSpend(input, new Date()));
        })
        .catch((e: unknown) => {
          if (active) setError(e instanceof Error ? e : new Error(String(e)));
        });
      return () => {
        active = false;
      };
    }, [db]),
  );

  return { result, error };
}
