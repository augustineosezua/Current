import { randomUUID } from 'node:crypto';

import type { SQLiteDatabase } from 'expo-sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addTransaction,
  checkInBalance,
  completeOnboarding,
  createAccount,
  createBill,
  deleteTransaction,
  editTransaction,
  markBillPaid,
  markBillUnpaid,
  updateAccount,
  CHECK_IN_MERCHANT,
} from './ledger';
import * as repo from './repo';
import { openTestDb } from './test-db';

vi.mock('expo-crypto', () => ({ randomUUID: () => randomUUID() }));

const day = (d: number) => new Date(2027, 0, d);
let db: SQLiteDatabase;
let chequing: string;

// balance of one account
async function balance(id: string): Promise<number> {
  return (await repo.accounts.get(db, id))!.balance;
}

beforeEach(async () => {
  db = await openTestDb();
  chequing = await createAccount(db, { name: 'Chequing', type: 'chequing', balance: 50_000 }, day(1));
});

describe('transactions adjust their account', () => {
  it('takes spending out and puts income in', async () => {
    await addTransaction(db, { accountId: chequing, amount: 450, date: day(2), merchantName: 'Tim Hortons' });
    expect(await balance(chequing)).toBe(49_550);
    await addTransaction(db, { accountId: chequing, amount: -120_000, date: day(3), merchantName: 'Pay' });
    expect(await balance(chequing)).toBe(169_550);
  });

  it('re-applies the difference when the amount is edited', async () => {
    const id = await addTransaction(db, { accountId: chequing, amount: 450, date: day(2), merchantName: 'Tim Hortons' });
    await editTransaction(db, id, { amount: 1_000 });
    expect(await balance(chequing)).toBe(49_000);
  });

  it('moves the amount when the account is edited', async () => {
    const cash = await createAccount(db, { name: 'Cash', type: 'cash', balance: 2_000 }, day(1));
    const id = await addTransaction(db, { accountId: chequing, amount: 450, date: day(2), merchantName: 'Tim Hortons' });
    await editTransaction(db, id, { accountId: cash });
    expect(await balance(chequing)).toBe(50_000);
    expect(await balance(cash)).toBe(1_550);
  });

  it('restores the balance on delete and hides the row', async () => {
    const id = await addTransaction(db, { accountId: chequing, amount: 450, date: day(2), merchantName: 'Tim Hortons' });
    await deleteTransaction(db, id);
    expect(await balance(chequing)).toBe(50_000);
    expect(await repo.transactions.list(db)).toHaveLength(0);
  });

  it('rolls back the row when the write fails part-way', async () => {
    await expect(
      addTransaction(db, { accountId: chequing, amount: 4.5, date: day(2), merchantName: 'Float' }),
    ).rejects.toThrow(/integer cents/);
    await expect(editTransaction(db, 'missing', { amount: 100 })).rejects.toThrow();
    expect(await repo.transactions.list(db)).toHaveLength(0);
    expect(await balance(chequing)).toBe(50_000);
  });
});

describe('balance check-ins', () => {
  it('logs the difference as an uncategorized transaction', async () => {
    const { drift } = await checkInBalance(db, chequing, 48_250, 'log', day(9));
    expect(drift).toBe(-1_750);
    expect(await balance(chequing)).toBe(48_250);
    const [t] = await repo.transactions.list(db);
    expect(t).toMatchObject({ amount: 1_750, merchantName: CHECK_IN_MERCHANT, categoryId: null });
    expect((await repo.accounts.get(db, chequing))!.lastCheckInAt).toEqual(day(9));
  });

  it('just updates the balance when asked', async () => {
    await checkInBalance(db, chequing, 51_000, 'update', day(9));
    expect(await balance(chequing)).toBe(51_000);
    expect(await repo.transactions.list(db)).toHaveLength(0);
    expect((await repo.accounts.get(db, chequing))!.lastCheckInAt).toEqual(day(9));
  });

  it('records the check-in without a transaction when the balance was right', async () => {
    await checkInBalance(db, chequing, 50_000, 'log', day(9));
    expect(await repo.transactions.list(db)).toHaveLength(0);
    expect((await repo.accounts.get(db, chequing))!.lastCheckInAt).toEqual(day(9));
  });
});

describe('editing an account', () => {
  it('saves a new balance with no transaction and counts it as a check-in', async () => {
    await updateAccount(db, chequing, { name: 'Main', type: 'chequing', balance: 61_000 }, day(9));
    const account = (await repo.accounts.get(db, chequing))!;
    expect(account).toMatchObject({ name: 'Main', balance: 61_000 });
    expect(account.lastCheckInAt).toEqual(day(9));
    expect(await repo.transactions.list(db)).toHaveLength(0);
  });

  it('leaves the check-in date alone when only the name changes', async () => {
    const before = (await repo.accounts.get(db, chequing))!.lastCheckInAt;
    await updateAccount(db, chequing, { name: 'Renamed', balance: 50_000 }, day(9));
    expect((await repo.accounts.get(db, chequing))!.lastCheckInAt).toEqual(before);
  });

  it('refuses a fractional balance', async () => {
    await expect(updateAccount(db, chequing, { balance: 10.5 })).rejects.toThrow(/integer cents/);
  });
});

describe('paid bills log themselves', () => {
  it('creates a linked transaction from the main chequing account', async () => {
    const rent = await createBill(db, { name: 'Rent', amount: 20_000, dueDate: day(20), frequency: null });
    expect(await markBillPaid(db, rent, { date: day(18) })).toEqual({ name: 'Rent', amount: 20_000 });
    const [t] = await repo.transactions.list(db);
    expect(t).toMatchObject({ amount: 20_000, merchantName: 'Rent', billId: rent, createdFromBill: true, accountId: chequing });
    expect(t!.date).toEqual(day(18));
    expect(await balance(chequing)).toBe(30_000);
    expect((await repo.bills.get(db, rent))!.isPaid).toBe(true);
  });

  it('uses the chosen account', async () => {
    const cash = await createAccount(db, { name: 'Cash', type: 'cash', balance: 30_000 }, day(1));
    const rent = await createBill(db, { name: 'Rent', amount: 20_000, dueDate: day(20), frequency: null });
    await markBillPaid(db, rent, { accountId: cash });
    expect(await balance(cash)).toBe(10_000);
    expect(await balance(chequing)).toBe(50_000);
  });

  it('undoing deletes the logged transaction and restores the balance', async () => {
    const rent = await createBill(db, { name: 'Rent', amount: 20_000, dueDate: day(20), frequency: null });
    await markBillPaid(db, rent);
    await markBillUnpaid(db, rent);
    expect(await repo.transactions.list(db)).toHaveLength(0);
    expect(await balance(chequing)).toBe(50_000);
    expect((await repo.bills.get(db, rent))!.isPaid).toBe(false);
  });

  it('leaves a transaction the user logged by hand', async () => {
    const rent = await createBill(db, { name: 'Rent', amount: 20_000, dueDate: day(20), frequency: null });
    await addTransaction(db, { accountId: chequing, amount: 20_000, date: day(18), merchantName: 'Rent e-transfer' });
    await db.runAsync('UPDATE transactions SET billId = ?', rent);
    await repo.bills.update(db, rent, { isPaid: true });
    await markBillUnpaid(db, rent);
    expect(await repo.transactions.list(db)).toHaveLength(1);
    expect(await balance(chequing)).toBe(30_000);
  });

  it('creates the next occurrence of a recurring bill, clamped to month end', async () => {
    const rent = await createBill(db, { name: 'Rent', amount: 20_000, dueDate: day(31), frequency: 'monthly' });
    await markBillPaid(db, rent);
    const next = (await repo.bills.list(db)).find((b) => b.id !== rent)!;
    expect(next).toMatchObject({ name: 'Rent', amount: 20_000, isPaid: false, frequency: 'monthly', anchorDay: 31, previousBillId: rent });
    expect(next.dueDate).toEqual(new Date(2027, 1, 28));
  });

  it('does not duplicate the next occurrence across undo and redo', async () => {
    const rent = await createBill(db, { name: 'Rent', amount: 20_000, dueDate: day(31), frequency: 'monthly' });
    await markBillPaid(db, rent);
    await markBillUnpaid(db, rent);
    expect(await repo.bills.list(db)).toHaveLength(1);
    await markBillPaid(db, rent);
    await markBillPaid(db, rent);
    expect(await repo.bills.list(db)).toHaveLength(2);
    expect(await repo.transactions.list(db)).toHaveLength(1);
  });
});

describe('onboarding', () => {
  it('writes the account, income, bills and the onboarded flag together', async () => {
    const fresh = await openTestDb();
    await completeOnboarding(
      fresh,
      {
        balance: 84_000,
        income: { amount: 120_000, frequency: 'biweekly', nextPaymentDate: day(15) },
        bills: [{ name: 'Phone', amount: 4_500, dueDate: day(12), frequency: 'monthly' }],
      },
      day(6),
    );
    const [account] = await repo.accounts.list(fresh);
    expect(account).toMatchObject({ type: 'chequing', balance: 84_000, isMain: true });
    expect(account!.lastCheckInAt).toEqual(day(6));
    expect(await repo.incomes.list(fresh)).toHaveLength(1);
    expect((await repo.bills.list(fresh))[0]).toMatchObject({ name: 'Phone', isRecurring: true, anchorDay: 12 });
    expect((await repo.getSettings(fresh)).onboarded).toBe(true);
  });
});
