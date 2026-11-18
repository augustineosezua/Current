import { randomUUID } from 'node:crypto';

import { calculateSafeToSpend, parseBankFile, reconcileSavings } from '@current/core';
import type { SQLiteDatabase } from 'expo-sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { addAskMessage, listChat, previousChatId } from './ask';
import { deleteCategoryBudget, listCategoryBudgets, saveCategoryBudget } from './budgets';
import { importTransactions } from './import';
import { addTransaction, createAccount } from './ledger';
import { allocateToGoal, saveGoal, saveTermPlan, withdrawFromGoal } from './plan';
import * as repo from './repo';
import { LOCAL_ONLY_TABLES, TABLES } from './schema';
import { loadStsInput } from './sts';
import { openTestDb } from './test-db';

vi.mock('expo-crypto', () => ({ randomUUID: () => randomUUID() }));
vi.mock('@/hooks/use-live-query', () => ({ useLiveQuery: () => ({ data: null, error: null }) }));

const day = (d: number, month = 0) => new Date(2027, month, d);
let db: SQLiteDatabase;
let chequing: string;

beforeEach(async () => {
  db = await openTestDb();
  chequing = await createAccount(db, { name: 'Chequing', type: 'chequing', balance: 100_000 }, day(1));
});

describe('2.3 category limits', () => {
  it('keeps one limit per category, and switching rollover on starts it today', async () => {
    await saveCategoryBudget(db, { categoryId: 'default-coffee', limit: 4_000, rollover: false }, day(3));
    await saveCategoryBudget(db, { categoryId: 'default-coffee', limit: 5_000, rollover: true }, day(9));
    const [b, ...rest] = await listCategoryBudgets(db);
    expect(rest).toEqual([]);
    expect(b).toMatchObject({ categoryId: 'default-coffee', limit: 5_000, rollover: true, since: day(9) });

    await deleteCategoryBudget(db, 'default-coffee');
    expect(await listCategoryBudgets(db)).toEqual([]);
  });

  it('never changes Safe-to-Spend', async () => {
    const before = calculateSafeToSpend(await loadStsInput(db), day(5)).safeToSpend;
    await saveCategoryBudget(db, { categoryId: 'default-fun', limit: 100, rollover: false });
    expect(calculateSafeToSpend(await loadStsInput(db), day(5)).safeToSpend).toBe(before);
  });

  it('refuses a zero limit', async () => {
    await expect(saveCategoryBudget(db, { categoryId: 'default-fun', limit: 0, rollover: false })).rejects.toThrow();
  });
});

describe('2.4 taking money out of a goal', () => {
  let savings: string;
  let goalId: string;

  beforeEach(async () => {
    savings = await createAccount(db, { name: 'Savings', type: 'savings', balance: 5_000 }, day(1));
    await saveGoal(db, null, { name: 'Laptop', amount: 50_000, dueDate: day(1, 5) });
    goalId = (await repo.goals.list(db))[0]!.id;
    await allocateToGoal(db, goalId, 20_000, day(4));
  });

  it('moves it from savings back to spending, and the goal and reconciliation follow', async () => {
    const moved = await withdrawFromGoal(db, goalId, 8_000, { now: day(10) });
    expect(moved).toBe(8_000);
    expect((await repo.accounts.get(db, chequing))!.balance).toBe(88_000);
    expect((await repo.accounts.get(db, savings))!.balance).toBe(17_000);
    expect((await repo.goals.get(db, goalId))!.amountSaved).toBe(12_000);

    const entries = await repo.transactions.list(db);
    expect(entries[0]).toMatchObject({ amount: -8_000, merchantName: 'Took out of Laptop', goalId, categoryId: 'default-savings' });

    const input = await loadStsInput(db);
    expect(reconcileSavings(input.accounts, input.goals).gap).toBe(5_000);
  });

  it('never takes out more than is saved, and links the purchase it paid for', async () => {
    const purchase = await addTransaction(db, { accountId: chequing, amount: 30_000, date: day(11), merchantName: 'Apple' });
    expect(await withdrawFromGoal(db, goalId, 99_000, { purchaseId: purchase, now: day(11) })).toBe(20_000);
    expect((await repo.goals.get(db, goalId))!.amountSaved).toBe(0);
    expect((await repo.transactions.get(db, purchase))!.goalId).toBe(goalId);
    await expect(withdrawFromGoal(db, goalId, 100)).rejects.toThrow();
  });
});

describe('2.4 Plus lifts the goal and term plan limits', () => {
  it('allows a fourth goal and a second term plan only with Plus', async () => {
    for (const name of ['A', 'B', 'C']) await saveGoal(db, null, { name, amount: 1_000, dueDate: day(1, 6) });
    await expect(saveGoal(db, null, { name: 'D', amount: 1_000, dueDate: day(1, 6) })).rejects.toThrow();
    await saveGoal(db, null, { name: 'D', amount: 1_000, dueDate: day(1, 6) }, true);
    expect(await repo.goals.list(db)).toHaveLength(4);

    const plan = { name: 'OSAP', amount: 100_000, startDate: day(6), endDate: day(30, 3) };
    await saveTermPlan(db, null, plan, day(6));
    await expect(saveTermPlan(db, null, plan, day(6))).rejects.toThrow();
    await saveTermPlan(db, null, plan, day(6), true);
    expect(await repo.termPlans.list(db)).toHaveLength(2);
  });
});

describe('2.5 import', () => {
  it('writes parsed rows with suggested categories, leaving the balance alone', async () => {
    const parsed = parseBankFile('2027-01-05,TIM HORTONS,4.50,\n2027-01-06,PAYROLL,,800.00\n')!;
    await importTransactions(db, parsed.rows, chequing, { 'tim hortons': 'default-coffee' }, day(8));
    const entries = await repo.transactions.list(db);
    expect(entries.map((e) => [e.merchantName, e.amount, e.categoryId])).toEqual([
      ['PAYROLL', -80_000, null],
      ['TIM HORTONS', 450, 'default-coffee'],
    ]);
    expect((await repo.accounts.get(db, chequing))!.balance).toBe(100_000);
  });
});

describe('2.13 Ask Current history', () => {
  it('keeps the conversation on the phone, in a table sync never sees', async () => {
    expect(TABLES as readonly string[]).not.toContain('ask_messages');
    expect(LOCAL_ONLY_TABLES).toContain('ask_messages');

    await addAskMessage(db, 'one', { role: 'user', text: 'How much on coffee?' });
    await addAskMessage(db, 'one', { role: 'assistant', text: 'You spent $12.', figures: [{ label: 'Spent', value: '$12.00' }], backend: 'on-device' });
    const messages = await listChat(db, 'one');
    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(messages[1]!.figures).toEqual([{ label: 'Spent', value: '$12.00' }]);
  });

  it('starts a new chat each time and keeps only the one before it', async () => {
    await addAskMessage(db, 'a', { role: 'user', text: 'first' });
    await addAskMessage(db, 'b', { role: 'user', text: 'second' });
    expect(await previousChatId(db, 'b')).toBe('a');
    await addAskMessage(db, 'c', { role: 'user', text: 'third' });
    expect(await listChat(db, 'a')).toEqual([]);
    expect((await listChat(db, 'b')).map((m) => m.text)).toEqual(['second']);
    expect(await previousChatId(db, 'c')).toBe('b');
  });
});
