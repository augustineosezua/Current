// 2.5 Import: write rows parsed from a bank export. Imported history is already reflected in the balance the user
// entered, so importing never moves an account balance; a balance check afterwards fixes any drift.
import { suggestCategory, type ImportedRow, type MerchantSeeds } from '@current/core';
import type { SQLiteDatabase } from 'expo-sqlite';

import { notifyChange } from './live';
import * as repo from './repo';

// insert the rows into one account, each filed under the category history (or the built-in list) suggests
export async function importTransactions(
  db: SQLiteDatabase,
  rows: readonly ImportedRow[],
  accountId: string | null,
  seeds: MerchantSeeds,
  now = new Date(),
): Promise<number> {
  const [history, categories] = await Promise.all([repo.transactions.list(db), repo.categories.list(db)]);
  const spendIds = categories.filter((c) => c.kind !== 'income').map((c) => c.id);
  const incomeIds = categories.filter((c) => c.kind === 'income').map((c) => c.id);

  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      const options = { seeds, categoryIds: row.amount < 0 ? incomeIds : spendIds };
      const suggestion = suggestCategory(history, row.merchantName, now, options);
      await repo.transactions.insert(db, {
        accountId: accountId ?? undefined,
        amount: row.amount,
        date: row.date,
        merchantName: row.merchantName,
        categoryId: suggestion?.categoryId ?? null,
        note: null,
        billId: null,
        createdFromBill: false,
        goalId: null,
      });
    }
  });
  notifyChange();
  return rows.length;
}
