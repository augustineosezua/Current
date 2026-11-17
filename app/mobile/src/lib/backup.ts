// When to offer the monthly "back up now" prompt. No Expo imports, so vitest can load it.
import { daysBetween } from '@current/core';

export const BACKUP_PROMPT_EVERY_DAYS = 30;

// due a month after the last export or dismissal, or a month after the first entry was logged
export function isBackupDue(nudgedAt: string | null, transactions: readonly { createdAt: string }[], now: Date): boolean {
  if (transactions.length === 0) return false;
  const since = nudgedAt ?? transactions.reduce((oldest, t) => (t.createdAt < oldest ? t.createdAt : oldest), transactions[0]!.createdAt);
  return daysBetween(new Date(since), now) >= BACKUP_PROMPT_EVERY_DAYS;
}
