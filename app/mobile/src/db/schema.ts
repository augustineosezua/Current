// Local database schema. Every table carries the same sync columns so a sync engine
// (ROADMAP 3.7) can be added without a migration:
//   id        client-generated UUID
//   updatedAt ISO timestamp, bumped on every write (last-write-wins)
//   deletedAt ISO timestamp when deleted; rows are never removed
// Money is INTEGER cents. Calendar dates are 'YYYY-MM-DD' (local), instants are ISO strings.
// No foreign key constraints: synced rows can arrive in any order.

export const TABLES = [
  'accounts',
  'categories',
  'transactions',
  'bills',
  'incomes',
  'goals',
  'term_plans',
  'settings',
] as const;

export type TableName = (typeof TABLES)[number];

const SYNC_COLUMNS = `
  id TEXT PRIMARY KEY NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT`;

const FREQUENCIES = `('one_time','daily','weekly','biweekly','semimonthly','monthly','yearly')`;

// each entry upgrades the database by one version; never edit a shipped entry
export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE accounts (${SYNC_COLUMNS},
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('chequing','savings','cash')),
    balance INTEGER NOT NULL DEFAULT 0,
    isMain INTEGER NOT NULL DEFAULT 0,
    lastCheckInAt TEXT,
    sortOrder INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE categories (${SYNC_COLUMNS},
    name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    color TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('needs','wants','savings','income')),
    sortOrder INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE transactions (${SYNC_COLUMNS},
    accountId TEXT,
    amount INTEGER NOT NULL,
    date TEXT NOT NULL,
    merchantName TEXT,
    categoryId TEXT,
    note TEXT,
    billId TEXT,
    createdFromBill INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX transactions_date ON transactions (date);
  CREATE INDEX transactions_account ON transactions (accountId);

  CREATE TABLE bills (${SYNC_COLUMNS},
    name TEXT NOT NULL,
    amount INTEGER NOT NULL,
    dueDate TEXT NOT NULL,
    isPaid INTEGER NOT NULL DEFAULT 0,
    isRecurring INTEGER NOT NULL DEFAULT 0,
    frequency TEXT CHECK (frequency IS NULL OR frequency IN ${FREQUENCIES}),
    anchorDay INTEGER,
    categoryId TEXT,
    accountId TEXT
  );

  CREATE TABLE incomes (${SYNC_COLUMNS},
    name TEXT,
    amount INTEGER NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ${FREQUENCIES}),
    nextPaymentDate TEXT,
    anchorDay INTEGER
  );

  CREATE TABLE goals (${SYNC_COLUMNS},
    name TEXT NOT NULL,
    amount INTEGER NOT NULL,
    amountSaved INTEGER NOT NULL DEFAULT 0,
    dueDate TEXT NOT NULL,
    priority INTEGER NOT NULL,
    isRecurring INTEGER NOT NULL DEFAULT 0,
    isCompleted INTEGER NOT NULL DEFAULT 0,
    lastContributionAt TEXT
  );

  CREATE TABLE term_plans (${SYNC_COLUMNS},
    name TEXT NOT NULL,
    amount INTEGER NOT NULL,
    startDate TEXT NOT NULL,
    endDate TEXT NOT NULL,
    isActive INTEGER NOT NULL DEFAULT 1
  );

  -- one row per setting; id is the setting key, value is JSON
  CREATE TABLE settings (${SYNC_COLUMNS},
    value TEXT NOT NULL
  );
  `,
  // 1.1: a recurring bill's next occurrence remembers the bill that created it, so undoing a payment can remove it
  `
  ALTER TABLE bills ADD COLUMN previousBillId TEXT;
  `,
];

export const DATABASE_VERSION = MIGRATIONS.length;
