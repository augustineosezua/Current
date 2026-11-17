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

const TYPES: readonly { value: AccountType; label: string }[] = [
  { value: 'chequing', label: 'Chequing' },
  { value: 'savings', label: 'Savings' },
  { value: 'cash', label: 'Cash' },
];

interface FormData {
  account: AccountRecord | null;
  count: number;
}

// the account being edited, and how many exist (the last one can't be deleted)
async function loadForm(db: SQLiteDatabase, id: string | undefined): Promise<FormData> {
  const accounts = await repo.accounts.list(db);
  return { account: accounts.find((a) => a.id === id) ?? null, count: accounts.length };
}

// add or edit an account; the balance is only typed here when the account is new
function AccountForm({ account, count }: FormData) {
  const db = useSQLiteContext();
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'chequing');
  const [balanceText, setBalanceText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const balance = toCents(balanceText);
  const valid = name.trim().length > 0 && (!!account || balance !== null);

  // create with an opening balance, or update the name and type
  const save = async () => {
    if (!valid) return;
    try {
      if (account) await updateAccount(db, account.id, { name: name.trim(), type });
      else await createAccount(db, { name: name.trim(), type, balance: balance ?? 0 });
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
    <Sheet title={account ? 'Edit account' : 'Add an account'}>
      <Field label="Name" value={name} onChangeText={setName} placeholder="Chequing" autoFocus={!account} />
      <Chips label="Type" options={TYPES} value={type} onChange={setType} />
      {type === 'savings' ? (
        <Text className="font-sans text-base leading-6 text-muted">Savings never count towards your daily number.</Text>
      ) : null}
      {account ? null : <AmountField label="What's in it right now?" value={balanceText} onChangeText={setBalanceText} allowNegative />}
      {error ? <Text className="font-sans-medium text-base text-ink">Couldn&apos;t save: {error}</Text> : null}
      <Button label="Save" onPress={save} disabled={!valid} />
      {account && count > 1 ? <Button label="Delete account" kind="plain" onPress={remove} /> : null}
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
