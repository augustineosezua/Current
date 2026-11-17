// Every write that moves money. Each exported function runs in one local database transaction,
// so a transaction row and its account balance can never disagree.
import {
  assertCents,
  getBalanceDrift,
  getDriftTransactionAmount,
  planBillPayment,
  type AccountType,
  type Cents,
  type Frequency,
} from '@current/core';
import type { SQLiteDatabase } from 'expo-sqlite';

import { notifyChange } from './live';
import type { AccountRecord, BillRecord, Fields, TransactionRecord } from './records';
import * as repo from './repo';

export const CHECK_IN_MERCHANT = 'Balance check-in';

export interface TransactionInput {
  accountId: string | null;
  // positive = money out
  amount: Cents;
  date: Date;
  merchantName: string | null;
  categoryId?: string | null;
  note?: string | null;
}

// run a write atomically, then tell mounted screens to re-read
async function write<T>(db: SQLiteDatabase, task: () => Promise<T>): Promise<T> {
  let result!: T;
  await db.withTransactionAsync(async () => {
    result = await task();
  });
  notifyChange();
  return result;
}

// move an account balance by a signed amount in one statement
async function adjustBalance(db: SQLiteDatabase, accountId: string | null | undefined, delta: Cents): Promise<void> {
  if (!accountId || delta === 0) return;
  await db.runAsync(
    'UPDATE accounts SET balance = balance + ?, updatedAt = ? WHERE id = ?',
    assertCents(delta, 'balance change'),
    new Date().toISOString(),
    accountId,
  );
}

// insert a transaction and take its amount out of the account (caller holds the transaction)
async function insertTransaction(db: SQLiteDatabase, fields: Fields<TransactionRecord>): Promise<string> {
  const id = await repo.transactions.insert(db, fields);
  await adjustBalance(db, fields.accountId, -fields.amount);
  return id;
}

// soft-delete a transaction and put its amount back (caller holds the transaction)
async function removeTransaction(db: SQLiteDatabase, id: string): Promise<void> {
  const existing = await repo.transactions.get(db, id);
  if (!existing) return;
  await repo.transactions.remove(db, id);
  await adjustBalance(db, existing.accountId, existing.amount);
}

// the account bill payments come out of by default: main, else first chequing, else first spendable
export function pickMainAccount(accounts: readonly AccountRecord[]): AccountRecord | null {
  return (
    accounts.find((a) => a.isMain && a.type !== 'savings') ??
    accounts.find((a) => a.type === 'chequing') ??
    accounts.find((a) => a.type !== 'savings') ??
    null
  );
}

// log a transaction and adjust its account
export function addTransaction(db: SQLiteDatabase, input: TransactionInput): Promise<string> {
  return write(db, () =>
    insertTransaction(db, {
      accountId: input.accountId ?? undefined,
      amount: input.amount,
      date: input.date,
      merchantName: input.merchantName,
      categoryId: input.categoryId ?? null,
      note: input.note ?? null,
      billId: null,
      createdFromBill: false,
    }),
  );
}

// change a transaction; the old amount goes back to its old account before the new one is taken
export function editTransaction(db: SQLiteDatabase, id: string, changes: Partial<TransactionInput>): Promise<void> {
  return write(db, async () => {
    const existing = await repo.transactions.get(db, id);
    if (!existing) throw new Error('That transaction no longer exists.');
    const accountId = changes.accountId === undefined ? existing.accountId : (changes.accountId ?? undefined);
    const amount = changes.amount ?? existing.amount;
    await adjustBalance(db, existing.accountId, existing.amount);
    await repo.transactions.update(db, id, { ...changes, accountId });
    await adjustBalance(db, accountId, -amount);
  });
}

// delete a transaction and restore its account balance
export function deleteTransaction(db: SQLiteDatabase, id: string): Promise<void> {
  return write(db, () => removeTransaction(db, id));
}

// add an account; the opening balance counts as its first check-in
export function createAccount(
  db: SQLiteDatabase,
  input: { name: string; type: AccountType; balance: Cents },
  now = new Date(),
): Promise<string> {
  return write(db, async () => {
    const existing = await repo.accounts.list(db);
    return repo.accounts.insert(db, {
      name: input.name,
      type: input.type,
      balance: assertCents(input.balance, 'balance'),
      isMain: input.type !== 'savings' && !pickMainAccount(existing),
      lastCheckInAt: now,
      sortOrder: existing.length,
    });
  });
}

// rename or retype an account
export function updateAccount(db: SQLiteDatabase, id: string, changes: { name?: string; type?: AccountType }): Promise<void> {
  return write(db, () => repo.accounts.update(db, id, changes));
}

// remove an account; its transactions stay in the history
export function deleteAccount(db: SQLiteDatabase, id: string): Promise<void> {
  return write(db, () => repo.accounts.remove(db, id));
}

export type CheckInMode = 'log' | 'update';

// record the real balance: either log the drift as an uncategorized transaction or just overwrite the balance
export function checkInBalance(
  db: SQLiteDatabase,
  accountId: string,
  entered: Cents,
  mode: CheckInMode,
  now = new Date(),
): Promise<{ drift: Cents }> {
  return write(db, async () => {
    const account = await repo.accounts.get(db, accountId);
    if (!account) throw new Error('That account no longer exists.');
    const drift = getBalanceDrift(account.balance, entered);

    // logging the difference moves the balance to the entered amount through the transaction
    if (mode === 'log' && drift !== 0) {
      await insertTransaction(db, {
        accountId,
        amount: getDriftTransactionAmount(drift),
        date: now,
        merchantName: CHECK_IN_MERCHANT,
        categoryId: null,
        note: null,
        billId: null,
        createdFromBill: false,
      });
      await repo.accounts.update(db, accountId, { lastCheckInAt: now });
    } else {
      await repo.accounts.update(db, accountId, { balance: entered, lastCheckInAt: now });
    }
    return { drift };
  });
}

export interface BillInput {
  name: string;
  amount: Cents;
  dueDate: Date;
  frequency: Frequency | null;
  accountId?: string | null;
  categoryId?: string | null;
}

// bill columns from form input; the anchor day remembers "the 31st" through short months
function billFields(input: BillInput): Omit<Fields<BillRecord>, 'isPaid' | 'previousBillId'> {
  const isRecurring = !!input.frequency && input.frequency !== 'one_time';
  return {
    name: input.name,
    amount: assertCents(input.amount, 'bill amount'),
    dueDate: input.dueDate,
    isRecurring,
    frequency: isRecurring ? input.frequency : null,
    anchorDay: isRecurring ? input.dueDate.getDate() : undefined,
    categoryId: input.categoryId ?? null,
    accountId: input.accountId ?? null,
  };
}

// add a bill
export function createBill(db: SQLiteDatabase, input: BillInput): Promise<string> {
  return write(db, () => repo.bills.insert(db, { ...billFields(input), isPaid: false, previousBillId: null }));
}

// change a bill's details
export function updateBill(db: SQLiteDatabase, id: string, input: BillInput): Promise<void> {
  return write(db, async () => {
    const existing = await repo.bills.get(db, id);
    const fields = billFields(input);
    // an untouched due date keeps its anchor, so "the 31st" survives an edit made in February
    const sameDay = !!existing && existing.dueDate.getTime() === input.dueDate.getTime();
    if (sameDay && fields.isRecurring && existing.anchorDay !== undefined) fields.anchorDay = existing.anchorDay;
    await repo.bills.update(db, id, fields);
  });
}

// remove a bill; a payment it already logged stays in the history
export function deleteBill(db: SQLiteDatabase, id: string): Promise<void> {
  return write(db, () => repo.bills.remove(db, id));
}

// mark a bill paid: logs its transaction and, for recurring bills, creates the next occurrence
export function markBillPaid(
  db: SQLiteDatabase,
  billId: string,
  options: { date?: Date; accountId?: string | null } = {},
): Promise<{ name: string; amount: Cents } | null> {
  return write(db, async () => {
    const bill = await repo.bills.get(db, billId);
    if (!bill || bill.isPaid) return null;
    const plan = planBillPayment(bill, options.date ?? new Date());
    const accountId = options.accountId ?? bill.accountId ?? pickMainAccount(await repo.accounts.list(db))?.id;

    await insertTransaction(db, {
      ...plan.transaction,
      accountId: accountId ?? undefined,
      categoryId: bill.categoryId,
      note: null,
    });
    await repo.bills.update(db, billId, { isPaid: true });

    // next occurrence, unless an earlier payment of this bill already created it
    if (plan.nextDueDate) {
      const spawned = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM bills WHERE previousBillId = ? AND deletedAt IS NULL',
        billId,
      );
      if (!spawned) {
        await repo.bills.insert(db, {
          name: bill.name,
          amount: bill.amount,
          dueDate: plan.nextDueDate,
          isPaid: false,
          isRecurring: true,
          frequency: bill.frequency,
          anchorDay: bill.anchorDay ?? bill.dueDate.getDate(),
          categoryId: bill.categoryId,
          accountId: bill.accountId,
          previousBillId: billId,
        });
      }
    }
    return { name: bill.name, amount: bill.amount };
  });
}

// mark a bill unpaid: deletes only the transaction it logged itself, and the still-unpaid next occurrence
export function markBillUnpaid(db: SQLiteDatabase, billId: string): Promise<void> {
  return write(db, async () => {
    const bill = await repo.bills.get(db, billId);
    if (!bill || !bill.isPaid) return;

    const logged = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM transactions WHERE billId = ? AND createdFromBill = 1 AND deletedAt IS NULL',
      billId,
    );
    for (const t of logged) await removeTransaction(db, t.id);
    await repo.bills.update(db, billId, { isPaid: false });

    const spawned = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM bills WHERE previousBillId = ? AND isPaid = 0 AND deletedAt IS NULL',
      billId,
    );
    for (const b of spawned) await repo.bills.remove(db, b.id);
  });
}

export interface OnboardingInput {
  balance: Cents;
  income: { amount: Cents; frequency: Frequency; nextPaymentDate: Date } | null;
  bills: readonly BillInput[];
}

// first-run setup: one chequing account, the next income and any bills, written together
export function completeOnboarding(db: SQLiteDatabase, input: OnboardingInput, now = new Date()): Promise<void> {
  return write(db, async () => {
    await repo.accounts.insert(db, {
      name: 'Chequing',
      type: 'chequing',
      balance: assertCents(input.balance, 'balance'),
      isMain: true,
      lastCheckInAt: now,
      sortOrder: 0,
    });

    if (input.income) {
      await repo.incomes.insert(db, {
        amount: assertCents(input.income.amount, 'income amount'),
        frequency: input.income.frequency,
        nextPaymentDate: input.income.nextPaymentDate,
        anchorDay: input.income.nextPaymentDate.getDate(),
      });
    }

    for (const bill of input.bills) {
      await repo.bills.insert(db, { ...billFields(bill), isPaid: false, previousBillId: null });
    }
    await repo.setSetting(db, 'onboarded', true);
  });
}
