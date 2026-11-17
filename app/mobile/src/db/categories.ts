// Category writes. Deleting is soft: entries that used the category stay and show as uncategorized.
import type { CategoryColor, CategoryKind } from '@current/core';
import type { SQLiteDatabase } from 'expo-sqlite';

import { notifyChange } from './live';
import * as repo from './repo';

export interface CategoryInput {
  name: string;
  emoji: string;
  color: CategoryColor;
  kind: CategoryKind;
}

// add a category at the end of the list
export async function createCategory(db: SQLiteDatabase, input: CategoryInput): Promise<string> {
  const existing = await repo.categories.list(db);
  const sortOrder = existing.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1;
  const id = await repo.categories.insert(db, { ...input, sortOrder });
  notifyChange();
  return id;
}

// rename or restyle a category
export async function updateCategory(db: SQLiteDatabase, id: string, changes: Partial<CategoryInput>): Promise<void> {
  await repo.categories.update(db, id, changes);
  notifyChange();
}

// move a category one place up or down the list
export async function moveCategory(db: SQLiteDatabase, id: string, direction: 'up' | 'down'): Promise<void> {
  const ordered = await repo.categories.list(db);
  const from = ordered.findIndex((c) => c.id === id);
  const to = direction === 'up' ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= ordered.length) return;
  [ordered[from], ordered[to]] = [ordered[to]!, ordered[from]!];

  // renumber so positions are always distinct; only changed rows are written, all or none
  await db.withTransactionAsync(async () => {
    for (const [sortOrder, category] of ordered.entries()) {
      if (category.sortOrder !== sortOrder) await repo.categories.update(db, category.id, { sortOrder });
    }
  });
  notifyChange();
}

// remove a category
export async function deleteCategory(db: SQLiteDatabase, id: string): Promise<void> {
  await repo.categories.remove(db, id);
  notifyChange();
}
