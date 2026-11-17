import { transactionsToCsv } from '@current/core';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import { toDateString } from '@/db/records';
import * as repo from '@/db/repo';

// write every transaction to a CSV in the cache folder and open the share sheet for it
export async function exportTransactions(db: SQLiteDatabase): Promise<void> {
  const [transactions, categories, accounts] = await Promise.all([
    repo.transactions.list(db),
    repo.categories.list(db),
    repo.accounts.list(db),
  ]);
  const file = new File(Paths.cache, `current-${toDateString(new Date())}.csv`);
  if (file.exists) file.delete();
  file.create();
  file.write(transactionsToCsv(transactions, categories, accounts));
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
}
