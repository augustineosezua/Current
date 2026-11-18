import { toCents, type AccountType } from '@current/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';

import { AmountField, Button, Chips, Field, Sheet } from '@/components/form';
import { createAccount, deleteAccount, updateAccount } from '@/db/ledger';
import type { AccountRecord } from '@/db/records';
import * as repo from '@/db/repo';
import { useLiveQuery } from '@/hooks/use-live-query';
import { t } from '@/i18n';
import { trackOnce } from '@/lib/analytics';

const TYPES: readonly { value: AccountType; label: string }[] = (['chequing', 'savings', 'cash'] as const).map((value) => ({
  value,
  label: t(`accountType.${value}`),
}));

interface FormData {
  account: AccountRecord | null;
  count: number;
}

// the account being edited, and how many exist (the last one can't be deleted)
async function loadForm(db: SQLiteDatabase, id: string | undefined): Promise<FormData> {
  const accounts = await repo.accounts.list(db);
  return { account: accounts.find((a) => a.id === id) ?? null, count: accounts.length };
}

// add or edit an account: name, type and balance
function AccountForm({ account, count }: FormData) {
  const db = useSQLiteContext();
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'chequing');
  const [balanceText, setBalanceText] = useState(account ? (account.balance / 100).toFixed(2) : '');
  const [error, setError] = useState<string | null>(null);

  const balance = toCents(balanceText);
  const valid = name.trim().length > 0 && balance !== null;

  // create with an opening balance, or update the name, type and balance
  const save = async () => {
    if (!valid || balance === null) return;
    try {
      if (account) await updateAccount(db, account.id, { name: name.trim(), type, balance });
      else {
        await createAccount(db, { name: name.trim(), type, balance });
        trackOnce('first_balance');
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // remove the account; its transactions stay in Activity
  const remove = async () => {
    if (!account) return;
    await deleteAccount(db, account.id);
    router.back();
  };

  return (
    <Sheet title={account ? t('account.edit') : t('account.add')}>
      <Field label={t('account.name')} value={name} onChangeText={setName} placeholder={t('account.placeholder')} autoFocus={!account} />
      <Chips label={t('account.type')} options={TYPES} value={type} onChange={setType} />
      {type === 'savings' ? <Text className="font-sans text-base leading-6 text-muted">{t('account.savingsNote')}</Text> : null}
      <AmountField
        label={account ? t('account.balance') : t('account.balanceNew')}
        value={balanceText}
        onChangeText={setBalanceText}
        allowNegative
      />
      {account ? (
        <Text className="font-sans text-base leading-6 text-muted">{t('account.balanceNote')}</Text>
      ) : null}
      {error ? <Text className="font-sans-medium text-base text-ink">{t('common.didntSave', { error })}</Text> : null}
      <Button label={t('common.save')} onPress={save} disabled={!valid} />
      {account && count > 1 ? <Button label={t('account.delete')} kind="plain" onPress={remove} /> : null}
    </Sheet>
  );
}

// add-account sheet, or edit with ?id=
export default function AccountScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const load = useCallback((db: SQLiteDatabase) => loadForm(db, id), [id]);
  const { data } = useLiveQuery(load, false);

  if (!data) return <Sheet title="">{null}</Sheet>;
  return <AccountForm account={data.account} count={data.count} />;
}
