import { formatMoney, getBalanceDrift, toCents } from '@current/core';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';

import { AmountField, Button, Sheet } from '@/components/form';
import { checkInBalance, type CheckInMode } from '@/db/ledger';
import type { AccountRecord } from '@/db/records';
import * as repo from '@/db/repo';
import { useLiveQuery } from '@/hooks/use-live-query';

// one plain line describing the gap between the real and the calculated balance
function driftLine(drift: number): string {
  if (drift === 0) return 'That matches. All good.';
  return `That's ${formatMoney(Math.abs(drift))} ${drift < 0 ? 'less' : 'more'} than we had.`;
}

// enter the real balance, see the drift, choose how to fix it
function CheckInForm({ account }: { account: AccountRecord }) {
  const db = useSQLiteContext();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const entered = toCents(text);
  const drift = entered === null ? null : getBalanceDrift(account.balance, entered);

  // record the check-in either way; only "log" writes a transaction
  const confirm = async (mode: CheckInMode) => {
    if (entered === null) return;
    try {
      await checkInBalance(db, account.id, entered, mode);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Sheet title="Check your balance">
      <Text className="font-sans text-base leading-6 text-muted">
        We think {account.name} has <Text className="font-sans-bold text-ink">{formatMoney(account.balance)}</Text>. Check your
        bank app and type in what it actually says.
      </Text>
      <AmountField label="Real balance" value={text} onChangeText={setText} autoFocus allowNegative />
      {drift !== null ? <Text className="font-sans-medium text-lg text-ink">{driftLine(drift)}</Text> : null}
      {error ? <Text className="font-sans-medium text-base text-ink">That didn&apos;t save: {error}</Text> : null}
      {drift === null || drift === 0 ? (
        <Button label="Confirm" onPress={() => confirm('update')} disabled={drift === null} />
      ) : (
        <>
          <Button label="Log the difference" onPress={() => confirm('log')} />
          <Button label="Just fix the balance" kind="secondary" onPress={() => confirm('update')} />
        </>
      )}
    </Sheet>
  );
}

// balance check-in sheet for one account (?id=)
export default function CheckInScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const load = useCallback((db: SQLiteDatabase) => repo.accounts.get(db, id), [id]);
  const { data } = useLiveQuery(load, false);

  if (!data) return <Sheet title="Check your balance">{null}</Sheet>;
  return <CheckInForm account={data} />;
}
