// 2.3 category limits and 2.12 rollover. One limit per category; limits are guidance and never touch Safe-to-Spend.
import { assertCents, startOfDay, type Cents } from '@current/core';
import type { SQLiteDatabase } from 'expo-sqlite';

import { t } from '../i18n';

import { notifyChange } from './live';
import type { CategoryBudgetRecord } from './records';
import * as repo from './repo';

export interface CategoryBudgetInput {
  categoryId: string;
  limit: Cents;
  rollover: boolean;
}

// set a category's limit, replacing any it had; switching rollover on starts it counting from today
export async function saveCategoryBudget(db: SQLiteDatabase, input: CategoryBudgetInput, now = new Date()): Promise<void> {
  const limit = assertCents(input.limit, 'limit');
  if (limit <= 0) throw new Error(t('error.amountAboveZero'));
  await db.withTransactionAsync(async () => {
    const existing = (await repo.categoryBudgets.list(db)).filter((b) => b.categoryId === input.categoryId);
    const [keep, ...extra] = existing;
    // a second row for the same category (from an older write or a sync) is folded away
    for (const b of extra) await repo.categoryBudgets.remove(db, b.id);
    if (keep) {
      const since = input.rollover && !keep.rollover ? startOfDay(now) : keep.since;
      await repo.categoryBudgets.update(db, keep.id, { limit, rollover: input.rollover, since });
    } else {
      await repo.categoryBudgets.insert(db, { categoryId: input.categoryId, limit, rollover: input.rollover, since: startOfDay(now) });
    }
  });
  notifyChange();
}

// remove a category's limit
export async function deleteCategoryBudget(db: SQLiteDatabase, categoryId: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const b of await repo.categoryBudgets.list(db)) if (b.categoryId === categoryId) await repo.categoryBudgets.remove(db, b.id);
  });
  notifyChange();
}

// every limit, one per category (the newest wins if a category somehow has two)
export async function listCategoryBudgets(db: SQLiteDatabase): Promise<CategoryBudgetRecord[]> {
  const byCategory = new Map<string, CategoryBudgetRecord>();
  for (const b of await repo.categoryBudgets.list(db)) {
    const seen = byCategory.get(b.categoryId);
    if (!seen || seen.updatedAt < b.updatedAt) byCategory.set(b.categoryId, b);
  }
  return [...byCategory.values()];
}
