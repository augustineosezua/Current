import { calculateSafeToSpend, type PeriodSettings, type StsResult } from '@current/core';
import type { SQLiteDatabase } from 'expo-sqlite';

import { useLiveQuery } from '@/hooks/use-live-query';

import { listCategoryBudgets } from './budgets';
import {
  fromDateString,
  type AccountRecord,
  type BillRecord,
  type CategoryBudgetRecord,
  type CategoryRecord,
  type GoalRecord,
  type IncomeRecord,
  type Settings,
  type TermPlanRecord,
  type TransactionRecord,
} from './records';
import * as repo from './repo';

// everything core needs for Safe-to-Spend, as stored locally
export interface BudgetData {
  accounts: AccountRecord[];
  bills: BillRecord[];
  goals: GoalRecord[];
  incomes: IncomeRecord[];
  termPlans: TermPlanRecord[];
  transactions: TransactionRecord[];
  categories: CategoryRecord[];
  // 2.3 limits; never part of the Safe-to-Spend math
  categoryBudgets: CategoryBudgetRecord[];
  // stored settings, plus the picked end date as the Date core reads
  settings: Settings & PeriodSettings;
}

// read every table core needs; core does the math, nothing is written back
export async function loadStsInput(db: SQLiteDatabase): Promise<BudgetData> {
  const [accounts, bills, goals, incomes, termPlans, transactions, categories, settings, categoryBudgets] = await Promise.all([
    repo.accounts.list(db),
    repo.bills.list(db),
    repo.goals.list(db),
    repo.incomes.list(db),
    repo.termPlans.list(db),
    repo.transactions.list(db),
    repo.categories.list(db),
    repo.getSettings(db),
    listCategoryBudgets(db),
  ]);
  const periodEndOverride = settings.budgetEndsOn ? fromDateString(settings.budgetEndsOn) : null;
  return {
    accounts,
    bills,
    goals,
    incomes,
    termPlans,
    transactions,
    categories,
    categoryBudgets,
    settings: { ...settings, periodEndOverride },
  };
}

// the data plus the number computed from it, so a screen never shows one without the other
async function loadBudget(db: SQLiteDatabase): Promise<{ input: BudgetData; result: StsResult }> {
  const input = await loadStsInput(db);
  return { input, result: calculateSafeToSpend(input, new Date()) };
}

// Safe-to-Spend for the focused screen, recomputed on focus and after every local write
export function useSafeToSpend(): { result: StsResult | null; input: BudgetData | null; error: Error | null } {
  const { data, error } = useLiveQuery(loadBudget);
  return { result: data?.result ?? null, input: data?.input ?? null, error };
}
