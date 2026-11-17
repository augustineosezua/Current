import type { SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_VERSION, MIGRATIONS } from './schema';

// bring the database up to DATABASE_VERSION, one migration per transaction
export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return;

  // first open: write-ahead logging for faster writes
  if (version === 0) await db.execAsync(`PRAGMA journal_mode = 'wal'`);

  // apply each pending migration and its version bump atomically
  while (version < DATABASE_VERSION) {
    const sql = MIGRATIONS[version]!;
    const next = version + 1;
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
      await db.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
}
