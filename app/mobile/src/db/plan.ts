// Writes for the budget's setup: paydays, term money, goals and settings. Each runs in one local transaction.
import {
  applyContribution,
  applyWithdrawal,
  daysBetween,
  startOfDay,
  assertCents,
  canAddGoal,
  canAddTermPlan,
  sortGoalsByPriority,
  type BudgetPeriodKind,
  type Cents,
  type Frequency,
} from '@current/core';
import type { SQLiteDatabase } from 'expo-sqlite';

import { t } from '../i18n';

import { pickMainAccount } from './ledger';
import { notifyChange } from './live';
import { toDateString, type GoalRecord, type SettingKey, type Settings } from './records';
import * as repo from './repo';

// run a write atomically, then tell mounted screens to re-read
async function write<T>(db: SQLiteDatabase, task: () => Promise<T>): Promise<T> {
  let result!: T;
  await db.withTransactionAsync(async () => {
    result = await task();
  });
  notifyChange();
  return result;
}

// change one setting
export function saveSetting<K extends SettingKey>(db: SQLiteDatabase, key: K, value: Settings[K]): Promise<void> {
  return write(db, () => repo.setSetting(db, key, value));
}

// how the budget is split up; null goes back to the default
export function setBudgetPeriod(db: SQLiteDatabase, kind: BudgetPeriodKind | null): Promise<void> {
  return saveSetting(db, 'budgetPeriod', kind);
}

// end the current budget on a day of the user's choosing (today or later), or null to go back to the normal end
export function setBudgetEnd(db: SQLiteDatabase, day: Date | null, now = new Date()): Promise<void> {
  if (day && daysBetween(startOfDay(now), day) < 0) return Promise.reject(new Error(t('error.pickTodayOrLater')));
  return saveSetting(db, 'budgetEndsOn', day ? toDateString(day) : null);
}

export interface IncomeInput {
  name: string | null;
  amount: Cents;
  frequency: Frequency;
  nextPaymentDate: Date;
}

// add a payday, or change one; the anchor day remembers "the 31st" through short months
export function saveIncome(db: SQLiteDatabase, id: string | null, input: IncomeInput): Promise<void> {
  return write(db, async () => {
    const fields = {
      name: input.name ?? undefined,
      amount: assertCents(input.amount, 'income amount'),
      frequency: input.frequency,
      nextPaymentDate: input.nextPaymentDate,
      anchorDay: input.nextPaymentDate.getDate(),
    };
    if (id) await repo.incomes.update(db, id, fields);
    else await repo.incomes.insert(db, fields);
  });
}

// remove a payday
export function deleteIncome(db: SQLiteDatabase, id: string): Promise<void> {
  return write(db, () => repo.incomes.remove(db, id));
}

export interface TermPlanInput {
  name: string;
  amount: Cents;
  startDate: Date;
  endDate: Date;
}

// add term money, or change it; the free app holds one current plan, Plus any number (2.4)
export function saveTermPlan(
  db: SQLiteDatabase,
  id: string | null,
  input: TermPlanInput,
  now = new Date(),
  isPlus = false,
): Promise<void> {
  return write(db, async () => {
    if (input.endDate.getTime() < input.startDate.getTime()) throw new Error(t('error.endAfterStart'));
    const fields = { ...input, amount: assertCents(input.amount, 'term amount'), isActive: true };
    if (id) {
      await repo.termPlans.update(db, id, fields);
      return;
    }
    if (!canAddTermPlan(await repo.termPlans.list(db), now, isPlus)) throw new Error(t('error.oneTermPlan'));
    await repo.termPlans.insert(db, fields);
  });
}

// remove term money
export function deleteTermPlan(db: SQLiteDatabase, id: string): Promise<void> {
  return write(db, () => repo.termPlans.remove(db, id));
}

export interface GoalInput {
  name: string;
  amount: Cents;
  dueDate: Date;
}

// add a goal at the bottom of the list, or change one; the free app holds three unfinished goals, Plus any number (2.4)
export function saveGoal(db: SQLiteDatabase, id: string | null, input: GoalInput, isPlus = false): Promise<void> {
  return write(db, async () => {
    const amount = assertCents(input.amount, 'goal amount');
    if (id) {
      const existing = await repo.goals.get(db, id);
      if (!existing) throw new Error(t('error.goalGone'));
      await repo.goals.update(db, id, { ...input, amount, isCompleted: existing.amountSaved >= amount });
      return;
    }
    const goals = await repo.goals.list(db);
    if (!canAddGoal(goals, isPlus)) throw new Error(t('error.threeGoals'));
    const lowest = goals.reduce((min, g) => Math.min(min, g.priority), 1);
    await repo.goals.insert(db, {
      ...input,
      amount,
      amountSaved: 0,
      priority: lowest - 1,
      isRecurring: false,
      isCompleted: false,
      lastContributionAt: null,
    });
  });
}

// remove a goal; money already set aside stays where it is
export function deleteGoal(db: SQLiteDatabase, id: string): Promise<void> {
  return write(db, () => repo.goals.remove(db, id));
}

// move a goal one place up or down the priority order
export function moveGoal(db: SQLiteDatabase, id: string, direction: 'up' | 'down'): Promise<void> {
  return write(db, async () => {
    const ordered = sortGoalsByPriority(await repo.goals.list(db)) as GoalRecord[];
    const from = ordered.findIndex((g) => g.id === id);
    const to = direction === 'up' ? from - 1 : from + 1;
    if (from < 0 || to < 0 || to >= ordered.length) return;
    [ordered[from], ordered[to]] = [ordered[to]!, ordered[from]!];

    // renumber top-down so priorities are always distinct; only changed rows are written
    for (const [index, goal] of ordered.entries()) {
      const priority = ordered.length - index;
      if (goal.priority !== priority) await repo.goals.update(db, goal.id, { priority });
    }
  });
}

// Set money aside for a goal: it leaves the spendable account as a Savings entry, lands in the savings account
// when there is one, and counts towards the goal. Returns what was actually set aside.
export function allocateToGoal(db: SQLiteDatabase, goalId: string, amount: Cents, now = new Date()): Promise<Cents> {
  return write(db, async () => {
    const goal = await repo.goals.get(db, goalId);
    if (!goal) throw new Error(t('error.goalGone'));
    const wanted = assertCents(amount, 'amount');
    if (wanted <= 0) throw new Error(t('error.amountAboveZero'));
    const moved = Math.min(wanted, Math.max(goal.amount - goal.amountSaved, 0));
    if (moved === 0) return 0;

    const [accounts, categories] = await Promise.all([repo.accounts.list(db), repo.categories.list(db)]);
    const from = pickMainAccount(accounts);
    const to = accounts.find((a) => a.type === 'savings');
    const stamp = now.toISOString();

    // the money leaves spending as a Savings entry, so it is never counted as spent
    await repo.transactions.insert(db, {
      accountId: from?.id,
      amount: moved,
      date: now,
      merchantName: t('ledger.savedFor', { goal: goal.name }),
      categoryId: categories.find((c) => c.kind === 'savings')?.id ?? null,
      note: null,
      billId: null,
      createdFromBill: false,
      goalId: goal.id,
    });
    if (from) await db.runAsync('UPDATE accounts SET balance = balance - ?, updatedAt = ? WHERE id = ?', moved, stamp, from.id);
    if (to) await db.runAsync('UPDATE accounts SET balance = balance + ?, updatedAt = ? WHERE id = ?', moved, stamp, to.id);

    const next = applyContribution(goal, moved, now);
    await repo.goals.update(db, goalId, {
      amountSaved: next.amountSaved,
      isCompleted: next.isCompleted,
      lastContributionAt: next.lastContributionAt,
    });
    return moved;
  });
}

// 2.4 Take money back out of a goal: it leaves the savings account (when there is one) and lands back in spending
// as a money-in entry, and the goal's saved amount drops. When it paid for something, that purchase is linked to
// the goal. Returns what was actually taken out (never more than is saved).
export function withdrawFromGoal(
  db: SQLiteDatabase,
  goalId: string,
  amount: Cents,
  options: { purchaseId?: string | null; now?: Date } = {},
): Promise<Cents> {
  return write(db, async () => {
    const now = options.now ?? new Date();
    const goal = await repo.goals.get(db, goalId);
    if (!goal) throw new Error(t('error.goalGone'));
    const wanted = assertCents(amount, 'amount');
    if (wanted <= 0) throw new Error(t('error.amountAboveZero'));
    if (goal.amountSaved <= 0) throw new Error(t('error.nothingSaved'));
    const moved = Math.min(wanted, goal.amountSaved);

    const [accounts, categories] = await Promise.all([repo.accounts.list(db), repo.categories.list(db)]);
    const to = pickMainAccount(accounts);
    const from = accounts.find((a) => a.type === 'savings');
    const stamp = now.toISOString();

    // money in on the spending side, filed under Savings so it never counts as income or spending
    await repo.transactions.insert(db, {
      accountId: to?.id,
      amount: -moved,
      date: now,
      merchantName: t('ledger.tookOutOf', { goal: goal.name }),
      categoryId: categories.find((c) => c.kind === 'savings')?.id ?? null,
      note: null,
      billId: null,
      createdFromBill: false,
      goalId: goal.id,
    });
    if (to) await db.runAsync('UPDATE accounts SET balance = balance + ?, updatedAt = ? WHERE id = ?', moved, stamp, to.id);
    if (from) await db.runAsync('UPDATE accounts SET balance = balance - ?, updatedAt = ? WHERE id = ?', moved, stamp, from.id);
    if (options.purchaseId) await repo.transactions.update(db, options.purchaseId, { goalId: goal.id });

    const next = applyWithdrawal(goal, moved);
    await repo.goals.update(db, goalId, { amountSaved: next.amountSaved, isCompleted: next.isCompleted });
    return moved;
  });
}
