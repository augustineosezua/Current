import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  fromRow,
  settingsFromRows,
  toRow,
  type Fields,
  type Row,
  type SettingKey,
  type Settings,
  type SyncMeta,
} from './records';
import type { TableName } from './schema';

interface TableRepo<R extends { id: string } & SyncMeta> {
  list(db: SQLiteDatabase): Promise<R[]>;
  get(db: SQLiteDatabase, id: string): Promise<R | null>;
  insert(db: SQLiteDatabase, fields: Fields<R>): Promise<string>;
  update(db: SQLiteDatabase, id: string, fields: Partial<Fields<R>>): Promise<void>;
  remove(db: SQLiteDatabase, id: string): Promise<void>;
}

// typed CRUD for one table; deletes are soft so sync can carry them
function table<R extends { id: string } & SyncMeta>(
  name: Exclude<TableName, 'settings'>,
  from: (r: Row) => R,
  to: (f: Partial<Fields<R>>) => Row,
  orderBy: string,
): TableRepo<R> {
  return {
    async list(db) {
      const rows = await db.getAllAsync<Row>(`SELECT * FROM ${name} WHERE deletedAt IS NULL ORDER BY ${orderBy}`);
      return rows.map(from);
    },
    async get(db, id) {
      const row = await db.getFirstAsync<Row>(`SELECT * FROM ${name} WHERE id = ? AND deletedAt IS NULL`, id);
      return row ? from(row) : null;
    },
    async insert(db, fields) {
      const id = Crypto.randomUUID();
      const now = new Date().toISOString();
      const row: Row = { ...to(fields), id, createdAt: now, updatedAt: now };
      const cols = Object.keys(row);
      await db.runAsync(
        `INSERT INTO ${name} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
        Object.values(row),
      );
      return id;
    },
    async update(db, id, fields) {
      const row: Row = { ...to(fields), updatedAt: new Date().toISOString() };
      const cols = Object.keys(row);
      await db.runAsync(
        `UPDATE ${name} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
        [...Object.values(row), id],
      );
    },
    async remove(db, id) {
      const now = new Date().toISOString();
      await db.runAsync(`UPDATE ${name} SET deletedAt = ?, updatedAt = ? WHERE id = ?`, now, now, id);
    },
  };
}

export const accounts = table('accounts', fromRow.account, toRow.account, 'sortOrder, createdAt');
export const categories = table('categories', fromRow.category, toRow.category, 'sortOrder, name');
export const transactions = table('transactions', fromRow.transaction, toRow.transaction, 'date DESC, createdAt DESC');
export const bills = table('bills', fromRow.bill, toRow.bill, 'dueDate');
export const incomes = table('incomes', fromRow.income, toRow.income, 'createdAt');
export const goals = table('goals', fromRow.goal, toRow.goal, 'priority DESC');
export const termPlans = table('term_plans', fromRow.termPlan, toRow.termPlan, 'startDate');
export const categoryBudgets = table('category_budgets', fromRow.categoryBudget, toRow.categoryBudget, 'createdAt');

// all settings, with defaults filled in
export async function getSettings(db: SQLiteDatabase): Promise<Settings> {
  return settingsFromRows(await db.getAllAsync<Row>('SELECT * FROM settings'));
}

// upsert one setting; the key doubles as the row id so devices converge on one row
export async function setSetting<K extends SettingKey>(db: SQLiteDatabase, key: K, value: Settings[K]): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO settings (id, value, createdAt, updatedAt) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt, deletedAt = NULL`,
    key,
    JSON.stringify(value),
    now,
    now,
  );
}
