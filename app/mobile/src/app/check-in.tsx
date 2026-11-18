import { getBalanceDrift, toCents } from '@current/core';
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
import { t } from '@/i18n';
import { money } from '@/lib/format';

// one plain line describing the gap between the real and the calculated balance
function driftLine(drift: number): string {
  if (drift === 0) return t('checkIn.matches');
  return t(drift < 0 ? 'checkIn.less' : 'checkIn.more', { amount: money(Math.abs(drift)) });
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
    <Sheet title={t('checkIn.title')}>
      <Text className="font-sans text-base leading-6 text-muted">
        {t('checkIn.intro', { account: account.name, amount: money(account.balance) })}
      </Text>
      <AmountField label={t('checkIn.real')} value={text} onChangeText={setText} autoFocus allowNegative />
      {drift !== null ? <Text className="font-sans-medium text-lg text-ink">{driftLine(drift)}</Text> : null}
      {error ? <Text className="font-sans-medium text-base text-ink">{t('common.didntSave', { error })}</Text> : null}
      {drift === null || drift === 0 ? (
        <Button label={t('checkIn.confirm')} onPress={() => confirm('update')} disabled={drift === null} />
      ) : (
        <>
          <Button label={t('checkIn.log')} onPress={() => confirm('log')} />
          <Button label={t('checkIn.fix')} kind="secondary" onPress={() => confirm('update')} />
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

  if (!data) return <Sheet title={t('checkIn.title')}>{null}</Sheet>;
  return <CheckInForm account={data} />;
}
