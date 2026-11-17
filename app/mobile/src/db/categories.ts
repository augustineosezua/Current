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

// Move a category one place up or down among categories of the same kind (Needs, Wants, ...). The screen shows
// them grouped by kind, so a step always lands next to a neighbour you can see.
export async function moveCategory(db: SQLiteDatabase, id: string, direction: 'up' | 'down'): Promise<void> {
  const ordered = await repo.categories.list(db);
  const me = ordered.find((c) => c.id === id);
  if (!me) return;
  const group = ordered.filter((c) => c.kind === me.kind);
  const at = group.indexOf(me);
  const other = group[direction === 'up' ? at - 1 : at + 1];
  if (!other) return;
  const a = ordered.indexOf(me);
  const b = ordered.indexOf(other);
  [ordered[a], ordered[b]] = [ordered[b]!, ordered[a]!];

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
