/// <reference types="node" />
// Test-only: an in-memory SQLite (node:sqlite) behind the slice of expo-sqlite's API the app uses.
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { SQLiteDatabase } from 'expo-sqlite';

import { migrateDbIfNeeded } from './migrate';

// expo-sqlite accepts params either spread or as one array
function flat(params: unknown[]): SQLInputValue[] {
  return (params.length === 1 && Array.isArray(params[0]) ? params[0] : params) as SQLInputValue[];
}

// a migrated in-memory database
export async function openTestDb(): Promise<SQLiteDatabase> {
  const raw = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (sql: string) => raw.exec(sql),
    runAsync: async (sql: string, ...params: unknown[]) => {
      const r = raw.prepare(sql).run(...flat(params));
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    getAllAsync: async (sql: string, ...params: unknown[]) => raw.prepare(sql).all(...flat(params)).map((r) => ({ ...r })),
    getFirstAsync: async (sql: string, ...params: unknown[]) => {
      const r = raw.prepare(sql).get(...flat(params));
      return r ? { ...r } : null;
    },
    // roll back on failure, like the real one
    withTransactionAsync: async (task: () => Promise<void>) => {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  } as unknown as SQLiteDatabase;
  await migrateDbIfNeeded(db);
  return db;
}
