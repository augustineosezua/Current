import { randomUUID } from 'node:crypto';

import { calculateSafeToSpend, planReminders, sortGoalsByPriority } from '@current/core';
import type { SQLiteDatabase } from 'expo-sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isBackupDue } from '../lib/backup';
import { reminderContent } from '../lib/reminder-text';
import { termPreset } from '../lib/term';
import { createAccount } from './ledger';
import { allocateToGoal, moveGoal, saveGoal, saveIncome, saveSetting, saveTermPlan, setBudgetEnd, setBudgetPeriod } from './plan';
import * as repo from './repo';
import { loadStsInput } from './sts';
import { openTestDb } from './test-db';

vi.mock('expo-crypto', () => ({ randomUUID: () => randomUUID() }));
// sts.ts also exports a hook; the loader under test doesn't need React or Expo
vi.mock('@/hooks/use-live-query', () => ({ useLiveQuery: () => ({ data: null, error: null }) }));

const day = (d: number, month = 0) => new Date(2027, month, d);
let db: SQLiteDatabase;
let chequing: string;

beforeEach(async () => {
  db = await openTestDb();
  chequing = await createAccount(db, { name: 'Chequing', type: 'chequing', balance: 100_000 }, day(1));
});

describe('budget period', () => {
  it('follows the setting, and a payday makes paycheque the default', async () => {
    const now = day(6);
    expect(calculateSafeToSpend(await loadStsInput(db), now).period.kind).toBe('monthly');

    await saveIncome(db, null, { name: 'Job', amount: 80_000, frequency: 'biweekly', nextPaymentDate: day(15) });
    const byPay = calculateSafeToSpend(await loadStsInput(db), now);
    expect(byPay.period.kind).toBe('paycheque');
    expect(byPay.daily.daysLeft).toBe(9);

    await setBudgetPeriod(db, 'monthly');
    expect(calculateSafeToSpend(await loadStsInput(db), now).period.kind).toBe('monthly');
  });

  it('ends the current budget on a picked day, and clears back to the normal end', async () => {
    await setBudgetPeriod(db, 'monthly');
    await setBudgetEnd(db, day(20), day(6));
    const picked = calculateSafeToSpend(await loadStsInput(db), day(6));
    expect(picked.period.end).toEqual(day(20));
    expect(picked.daily.daysLeft).toBe(15);

    await setBudgetEnd(db, null);
    expect(calculateSafeToSpend(await loadStsInput(db), day(6)).period.end).toEqual(day(31));
  });

  it('refuses an end day in the past', async () => {
    await expect(setBudgetEnd(db, day(5), day(6))).rejects.toThrow(/today/);
  });

  it('edits a payday in place', async () => {
    await saveIncome(db, null, { name: null, amount: 80_000, frequency: 'biweekly', nextPaymentDate: day(15) });
    const [income] = await repo.incomes.list(db);
    await saveIncome(db, income!.id, { name: 'Library', amount: 90_000, frequency: 'monthly', nextPaymentDate: day(31) });
    const all = await repo.incomes.list(db);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ name: 'Library', amount: 90_000, frequency: 'monthly', anchorDay: 31 });
  });
});

describe('term money', () => {
  const winter = { name: 'Winter OSAP', amount: 400_000, startDate: day(6), endDate: new Date(2027, 3, 30) };

  it('holds back the part meant for later weeks', async () => {
    await repo.accounts.update(db, chequing, { balance: 400_000 });
    await saveTermPlan(db, null, winter, day(6));
    const first = calculateSafeToSpend(await loadStsInput(db), day(6));
    expect(first.safeToSpend).toBeGreaterThan(3_400);
    expect(first.safeToSpend).toBeLessThan(3_600);
  });

  it('allows one current plan on the free app, and another once it has ended', async () => {
    await saveTermPlan(db, null, winter, day(6));
    await expect(saveTermPlan(db, null, { ...winter, name: 'Second' }, day(10))).rejects.toThrow(/already/);
    await saveTermPlan(db, null, { ...winter, name: 'Summer', startDate: new Date(2027, 4, 3), endDate: new Date(2027, 7, 20) }, new Date(2027, 4, 1));
    expect(await repo.termPlans.list(db)).toHaveLength(2);
  });

  it('rejects an end before the start', async () => {
    await expect(saveTermPlan(db, null, { ...winter, endDate: day(2) }, day(6))).rejects.toThrow(/end date/);
  });

  it('names the plan for the storefront', () => {
    expect(termPreset('CA').name).toBe('OSAP');
    expect(termPreset('US').name).toBe('Financial aid refund');
    expect(termPreset('GB').name).toBe('Maintenance loan');
  });
});

describe('goals', () => {
  const laptop = { name: 'Laptop', amount: 60_000, dueDate: new Date(2027, 5, 1) };
  const trip = { name: 'Trip', amount: 30_000, dueDate: new Date(2027, 7, 1) };

  it('adds new goals below existing ones and stops at three on the free app', async () => {
    await saveGoal(db, null, laptop);
    await saveGoal(db, null, trip);
    await saveGoal(db, null, { ...trip, name: 'Bike' });
    expect(sortGoalsByPriority(await repo.goals.list(db)).map((g) => g.name)).toEqual(['Laptop', 'Trip', 'Bike']);
    await expect(saveGoal(db, null, { ...trip, name: 'Car' })).rejects.toThrow(/three goals/);
  });

  it('reorders by priority', async () => {
    await saveGoal(db, null, laptop);
    await saveGoal(db, null, trip);
    const [, second] = sortGoalsByPriority(await repo.goals.list(db));
    await moveGoal(db, second!.id, 'up');
    expect(sortGoalsByPriority(await repo.goals.list(db)).map((g) => g.name)).toEqual(['Trip', 'Laptop']);
    await moveGoal(db, second!.id, 'up');
    expect(sortGoalsByPriority(await repo.goals.list(db)).map((g) => g.name)).toEqual(['Trip', 'Laptop']);
  });

  it('setting money aside moves it out of spending, into savings and onto the goal', async () => {
    const savings = await createAccount(db, { name: 'Savings', type: 'savings', balance: 5_000 }, day(1));
    await saveGoal(db, null, laptop);
    const [goal] = await repo.goals.list(db);

    const moved = await allocateToGoal(db, goal!.id, 10_000, day(8));
    expect(moved).toBe(10_000);
    expect((await repo.accounts.get(db, chequing))!.balance).toBe(90_000);
    expect((await repo.accounts.get(db, savings))!.balance).toBe(15_000);
    expect(await repo.goals.get(db, goal!.id)).toMatchObject({ amountSaved: 10_000, isCompleted: false });

    const [entry] = await repo.transactions.list(db);
    expect(entry).toMatchObject({ amount: 10_000, merchantName: 'Saved for Laptop', categoryId: 'default-savings', accountId: chequing });
  });

  it('never sets aside more than the goal still needs, and finishes it', async () => {
    await saveGoal(db, null, trip);
    const [goal] = await repo.goals.list(db);
    expect(await allocateToGoal(db, goal!.id, 99_999, day(8))).toBe(30_000);
    expect(await repo.goals.get(db, goal!.id)).toMatchObject({ amountSaved: 30_000, isCompleted: true });
    expect((await repo.accounts.get(db, chequing))!.balance).toBe(70_000);
    expect(await allocateToGoal(db, goal!.id, 1_000, day(9))).toBe(0);
  });

  it('a finished goal frees a slot', async () => {
    await saveGoal(db, null, trip);
    await saveGoal(db, null, laptop);
    await saveGoal(db, null, { ...trip, name: 'Bike' });
    const goals = await repo.goals.list(db);
    await allocateToGoal(db, goals.find((g) => g.name === 'Trip')!.id, 30_000, day(8));
    await saveGoal(db, null, { ...trip, name: 'Car' });
    expect(await repo.goals.list(db)).toHaveLength(4);
  });
});

describe('reminder wording', () => {
  const bill = { id: 'b', name: 'Rent', amount: 120_000, dueDate: day(15), isPaid: false, isRecurring: false, frequency: null };

  it('names one bill, or counts several', () => {
    // Jan 12 2027 is a Tuesday, so the bill is due Friday
    expect(reminderContent({ kind: 'bill', date: day(12), bills: [bill] })).toEqual({
      title: 'Rent is due Friday',
      body: '$1,200.00. Your daily number already accounts for it.',
    });
    const two = reminderContent({ kind: 'bill', date: day(12), bills: [bill, { ...bill, id: 'p', name: 'Phone', amount: 4_500 }] });
    expect(two.title).toBe('2 bills due Friday');
    expect(two.body).toBe('Rent and Phone, $1,245.00 total. Your daily number already accounts for them.');
  });

  it('writes the Sunday summary from figures, or a plain invitation without them', () => {
    const week = { start: day(11), end: day(17), spent: 14_250, lastWeekSpent: 16_000, topCategories: [] };
    const body = reminderContent(
      { kind: 'summary', date: day(17) },
      { week, topCategoryNames: ['Groceries', 'Eating out', 'Transit'], perDay: 2_300, periodEnd: day(22) },
    ).body;
    expect(body).toBe('Spent $142 this week, $17 less than last week. Mostly Groceries, Eating out and Transit. $23/day until Friday, Jan 22.');
    expect(reminderContent({ kind: 'summary', date: day(24) }).body).toBe('Tap to see how your week went.');
  });

  it('respects the toggles stored in settings', async () => {
    await repo.bills.insert(db, { ...bill, categoryId: null, accountId: null, previousBillId: null });
    await saveSetting(db, 'reminders', { bills: false, summary: false, checkIn: true });
    const input = await loadStsInput(db);
    const plan = planReminders({ bills: input.bills, accounts: input.accounts, settings: input.settings.reminders }, day(6));
    expect(plan.every((r) => r.kind === 'checkIn')).toBe(true);
    expect(plan.length).toBeGreaterThan(0);
  });
});

describe('backup prompt', () => {
  const logged = [{ createdAt: '2027-01-02T10:00:00.000Z' }];

  it('waits a month from the first entry, then a month from each export or dismissal', () => {
    expect(isBackupDue(null, [], day(1, 5))).toBe(false);
    expect(isBackupDue(null, logged, day(20))).toBe(false);
    expect(isBackupDue(null, logged, day(5, 1))).toBe(true);
    expect(isBackupDue('2027-02-05T10:00:00.000Z', logged, day(20, 1))).toBe(false);
    expect(isBackupDue('2027-02-05T10:00:00.000Z', logged, day(10, 2))).toBe(true);
  });
});
