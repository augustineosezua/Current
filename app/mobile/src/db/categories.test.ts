import { randomUUID } from 'node:crypto';

import { DEFAULT_CATEGORIES } from '@current/core';
import type { SQLiteDatabase } from 'expo-sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { categoriesFor, CATEGORY_FILLS, lastEmoji, suggestCategoryId } from '../lib/categories';
import { createCategory, deleteCategory, moveCategory, updateCategory } from './categories';
import { addTransaction } from './ledger';
import * as repo from './repo';
import { openTestDb } from './test-db';

vi.mock('expo-crypto', () => ({ randomUUID: () => randomUUID() }));

let db: SQLiteDatabase;

beforeEach(async () => {
  db = await openTestDb();
});

describe('default categories', () => {
  it('are seeded by the migration with fixed ids, in order', async () => {
    const rows = await repo.categories.list(db);
    expect(rows.map((c) => c.id)).toEqual(DEFAULT_CATEGORIES.map((c) => c.id));
    expect(rows[0]).toMatchObject({ name: 'Groceries', emoji: '🛒', color: 'sage', kind: 'needs', sortOrder: 0 });
    for (const c of rows) expect(c.color in CATEGORY_FILLS).toBe(true);
  });
});

describe('editing categories', () => {
  it('adds a new one at the end', async () => {
    const id = await createCategory(db, { name: 'Takeout', emoji: '🍜', color: 'coral', kind: 'wants' });
    const rows = await repo.categories.list(db);
    expect(rows[rows.length - 1]).toMatchObject({ id, name: 'Takeout', sortOrder: 12 });
  });

  it('renames and restyles', async () => {
    await updateCategory(db, 'default-coffee', { name: 'Caffeine', emoji: '🍵' });
    expect(await repo.categories.get(db, 'default-coffee')).toMatchObject({ name: 'Caffeine', emoji: '🍵', color: 'sand' });
  });

  it('deletes softly, leaving the entries that used it', async () => {
    const t = await addTransaction(db, {
      accountId: null,
      amount: 450,
      date: new Date(2027, 0, 2),
      merchantName: 'Tim Hortons',
      categoryId: 'default-coffee',
    });
    await deleteCategory(db, 'default-coffee');
    expect(await repo.categories.get(db, 'default-coffee')).toBeNull();
    expect((await repo.transactions.get(db, t))?.categoryId).toBe('default-coffee');
  });
});

describe('reordering categories', () => {
  const order = async () => (await repo.categories.list(db)).map((c) => c.id);

  it('moves past the nearest category of the same kind and keeps the rest in order', async () => {
    // Coffee (want) moves above Eating out (want)
    await moveCategory(db, 'default-coffee', 'up');
    expect((await order()).slice(0, 4)).toEqual(['default-groceries', 'default-coffee', 'default-eating-out', 'default-transit']);
    // Groceries (need) moves below Transit, the next need, skipping the wants in between
    await moveCategory(db, 'default-groceries', 'down');
    expect((await order()).slice(0, 4)).toEqual(['default-transit', 'default-coffee', 'default-eating-out', 'default-groceries']);
  });

  it('does nothing at either end of its group', async () => {
    const before = await order();
    await moveCategory(db, 'default-groceries', 'up');
    await moveCategory(db, 'default-subscriptions', 'down');
    await moveCategory(db, 'default-income', 'down');
    expect(await order()).toEqual(before);
  });

  it('still works after a category in the middle was deleted', async () => {
    await deleteCategory(db, 'default-coffee');
    await moveCategory(db, 'default-fun', 'up');
    const wants = (await repo.categories.list(db)).filter((c) => c.kind === 'wants').map((c) => c.id);
    expect(wants.slice(0, 2)).toEqual(['default-fun', 'default-eating-out']);
    const sortOrders = (await repo.categories.list(db)).map((c) => c.sortOrder);
    expect(new Set(sortOrders).size).toBe(sortOrders.length);
  });
});

describe('typing your own sticker', () => {
  it('takes the newest emoji and ignores letters, digits and spaces', () => {
    expect(lastEmoji('🍕')).toBe('🍕');
    expect(lastEmoji('🍕🍣')).toBe('🍣');
    expect(lastEmoji('pizza 🍕 2')).toBe('🍕');
    expect(lastEmoji('abc 123')).toBeNull();
    expect(lastEmoji('')).toBeNull();
  });

  it('keeps multi-part emoji whole', () => {
    expect(lastEmoji('👍🏽')).toBe('👍🏽');
    expect(lastEmoji('🛍️')).toBe('🛍️');
    expect(lastEmoji('x👩‍🍳')).toBe('👩‍🍳');
    expect(lastEmoji('👨‍👩‍👧‍👦')).toBe('👨‍👩‍👧‍👦');
    expect(lastEmoji('🍕🇨🇦')).toBe('🇨🇦');
    expect(lastEmoji('1️⃣')).toBe('1️⃣');
    expect(lastEmoji('🏴󠁧󠁢󠁳󠁣󠁴󠁿')).toBe('🏴󠁧󠁢󠁳󠁣󠁴󠁿');
  });
});

describe('suggestions in the form', () => {
  it('offers income categories only for money in', async () => {
    const all = await repo.categories.list(db);
    expect(categoriesFor(all, 'in').map((c) => c.id)).toEqual(['default-income']);
    expect(categoriesFor(all, 'out')).toHaveLength(11);
  });

  it('never suggests a category the picker is not showing', async () => {
    const all = await repo.categories.list(db);
    const now = new Date(2027, 0, 10);
    expect(suggestCategoryId([], categoriesFor(all, 'out'), 'coffee', now)).toBe('default-coffee');
    expect(suggestCategoryId([], categoriesFor(all, 'in'), 'coffee', now)).toBeNull();
    await deleteCategory(db, 'default-coffee');
    expect(suggestCategoryId([], categoriesFor(await repo.categories.list(db), 'out'), 'coffee', now)).toBeNull();
  });
});
