// 2.13 Ask Current conversations. Stored on this phone only, in a table with no sync columns, and never synced.
// Each opening of the Ask screen is a new chat; the one before it is kept so it can be reopened, older ones go.
import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { notifyChange } from './live';

export interface AskFigure {
  label: string;
  value: string;
}

// a purchase Ask Current offers to log; nothing is saved until the user confirms it
export interface AskAction {
  type: 'log_expense';
  // cents, positive
  amount: number;
  merchant: string | null;
  categoryId: string | null;
  // set once the user logs it (the new transaction) or dismisses it
  status: 'pending' | 'done' | 'dismissed';
  transactionId?: string;
}

export interface AskMessage {
  id: string;
  createdAt: string;
  role: 'user' | 'assistant';
  text: string;
  // the figures an answer was written from, so a wrong sentence can be checked
  figures: AskFigure[];
  backend: string | null;
  action: AskAction | null;
}

// messages from before chats existed have no chat id; they read as one earlier chat
const LEGACY = 'legacy';

// a fresh chat id
export function newChatId(): string {
  return Crypto.randomUUID();
}

// one chat, oldest first
export async function listChat(db: SQLiteDatabase, chatId: string): Promise<AskMessage[]> {
  const rows = await db.getAllAsync<{
    id: string;
    createdAt: string;
    role: string;
    text: string;
    figures: string | null;
    backend: string | null;
    action: string | null;
  }>(
    'SELECT * FROM ask_messages WHERE COALESCE(chatId, ?) = ? ORDER BY createdAt, rowid',
    LEGACY,
    chatId,
  );
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    role: r.role === 'user' ? 'user' : 'assistant',
    text: r.text,
    figures: r.figures ? (JSON.parse(r.figures) as AskFigure[]) : [],
    backend: r.backend,
    action: r.action ? (JSON.parse(r.action) as AskAction) : null,
  }));
}

// the most recent chat other than this one, or null
export async function previousChatId(db: SQLiteDatabase, current: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ chat: string }>(
    'SELECT COALESCE(chatId, ?) AS chat FROM ask_messages WHERE COALESCE(chatId, ?) != ? ORDER BY createdAt DESC, rowid DESC LIMIT 1',
    LEGACY,
    LEGACY,
    current,
  );
  return row?.chat ?? null;
}

// add one message to a chat; once a chat has messages, only it and the one before it are kept
export async function addAskMessage(
  db: SQLiteDatabase,
  chatId: string,
  message: { role: AskMessage['role']; text: string; figures?: AskFigure[]; backend?: string | null; action?: AskAction | null },
): Promise<void> {
  const previous = await previousChatId(db, chatId);
  await db.runAsync(
    'INSERT INTO ask_messages (id, createdAt, role, text, figures, backend, chatId, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    Crypto.randomUUID(),
    new Date().toISOString(),
    message.role,
    message.text,
    message.figures?.length ? JSON.stringify(message.figures) : null,
    message.backend ?? null,
    chatId,
    message.action ? JSON.stringify(message.action) : null,
  );
  await db.runAsync('DELETE FROM ask_messages WHERE COALESCE(chatId, ?) NOT IN (?, ?)', LEGACY, chatId, previous ?? chatId);
  notifyChange();
}

// record what happened to an offered action (logged or dismissed)
export async function setAskAction(db: SQLiteDatabase, messageId: string, action: AskAction): Promise<void> {
  await db.runAsync('UPDATE ask_messages SET action = ? WHERE id = ?', JSON.stringify(action), messageId);
  notifyChange();
}
