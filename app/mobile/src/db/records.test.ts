import { describe, expect, it } from 'vitest';

import { MIGRATIONS, TABLES } from './schema';
import {
  fromDateString,
  fromRow,
  settingsFromRows,
  toDateString,
  toRow,
  DEFAULT_SETTINGS,
  type Row,
} from './records';

const meta = { id: 'a1', createdAt: '2027-01-06T10:00:00.000Z', updatedAt: '2027-01-06T10:00:00.000Z', deletedAt: null };

describe('calendar dates', () => {
  it('round-trips a local date without shifting a day', () => {
    const d = new Date(2027, 0, 31);
    expect(toDateString(d)).toBe('2027-01-31');
    expect(fromDateString('2027-01-31')).toEqual(d);
  });

  it('parses to local midnight, which core expects', () => {
    const d = fromDateString('2027-03-14');
    expect([d.getHours(), d.getMinutes(), d.getDate()]).toEqual([0, 0, 14]);
  });

  it('rejects malformed strings', () => {
    expect(() => fromDateString('nope')).toThrow();
  });
});

describe('row mappers', () => {
  it('maps a transaction row to core types', () => {
    const row: Row = {
      ...meta,
      accountId: 'acc',
      amount: 450,
      date: '2027-01-08',
      merchantName: 'Tim Hortons',
      categoryId: null,
      note: null,
      billId: null,
      createdFromBill: 0,
    };
    const t = fromRow.transaction(row);
    expect(t.amount).toBe(450);
    expect(t.date).toEqual(new Date(2027, 0, 8));
    expect(t.createdFromBill).toBe(false);
    expect(t.deletedAt).toBeNull();
  });

  it('round-trips a bill through toRow and fromRow', () => {
    const fields = {
      name: 'Rent',
      amount: 95000,
      dueDate: new Date(2027, 0, 31),
      isPaid: false,
      isRecurring: true,
      frequency: 'monthly' as const,
      anchorDay: 31,
      categoryId: null,
      accountId: null,
      previousBillId: null,
    };
    const bill = fromRow.bill({ ...meta, ...toRow.bill(fields) });
    expect(bill).toMatchObject(fields);
  });

  it('stores booleans as 0/1 and instants as ISO', () => {
    const at = new Date('2027-02-01T15:30:00.000Z');
    const row = toRow.goal({ isCompleted: true, lastContributionAt: at });
    expect(row).toEqual({ isCompleted: 1, lastContributionAt: '2027-02-01T15:30:00.000Z' });
  });

  it('only includes fields that were passed, so partial updates leave other columns alone', () => {
    expect(toRow.account({ balance: 1200 })).toEqual({ balance: 1200 });
  });

  it('writes explicit nulls when a field is cleared', () => {
    expect(toRow.income({ nextPaymentDate: null })).toEqual({ nextPaymentDate: null });
  });

  it('refuses non-integer money', () => {
    expect(() => toRow.transaction({ amount: 4.5 })).toThrow(/integer cents/);
  });
});

describe('settings', () => {
  it('falls back to defaults for missing, deleted or unreadable keys', () => {
    const rows: Row[] = [
      { ...meta, id: 'budgetPeriod', value: '"term"' },
      { ...meta, id: 'minimumMonthlySpend', value: 'not json' },
      { ...meta, id: 'unknownKey', value: '1' },
    ];
    expect(settingsFromRows(rows)).toEqual({ budgetPeriod: 'term', minimumMonthlySpend: 0, onboarded: false });
    expect(settingsFromRows([])).toEqual(DEFAULT_SETTINGS);
  });
});

describe('schema', () => {
  it('gives every table the sync columns', () => {
    const sql = MIGRATIONS.join('\n');
    for (const table of TABLES) {
      const body = sql.split(`CREATE TABLE ${table} (`)[1];
      expect(body, table).toBeDefined();
      for (const col of ['id TEXT PRIMARY KEY', 'createdAt TEXT', 'updatedAt TEXT', 'deletedAt TEXT']) {
        expect(body, `${table}.${col}`).toContain(col);
      }
    }
  });

  it('stores money as INTEGER', () => {
    expect(MIGRATIONS.join('\n')).not.toMatch(/\b(REAL|FLOAT|DOUBLE|NUMERIC)\b/i);
  });
});
