import { toCents } from '@current/core';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';

import { CategoryPicker } from '@/components/category-picker';
import { DateField } from '@/components/date-field';
import { AmountField, Button, Chips, Field, Sheet } from '@/components/form';
import { addTransaction, deleteTransaction, editTransaction, pickMainAccount } from '@/db/ledger';
import type { AccountRecord, CategoryRecord, TransactionRecord } from '@/db/records';
import * as repo from '@/db/repo';
import { useLiveQuery } from '@/hooks/use-live-query';
import { categoriesFor, suggestCategoryId } from '@/lib/categories';

const DIRECTIONS = [
  { value: 'out', label: 'Spent' },
  { value: 'in', label: 'Got paid' },
] as const;
type Direction = (typeof DIRECTIONS)[number]['value'];

interface FormData {
  accounts: AccountRecord[];
  categories: CategoryRecord[];
  // everything logged so far, for category suggestions
  history: TransactionRecord[];
  transaction: TransactionRecord | null;
}

// accounts and categories to choose from, past entries to suggest from and, when editing, the entry being changed
async function loadForm(db: SQLiteDatabase, id: string | undefined): Promise<FormData> {
  const [accounts, categories, history] = await Promise.all([
    repo.accounts.list(db),
    repo.categories.list(db),
    repo.transactions.list(db),
  ]);
  return { accounts, categories, history, transaction: history.find((t) => t.id === id) ?? null };
}

// amount as the user would type it, e.g. 450 -> "4.50"
function centsToText(cents: number): string {
  return (Math.abs(cents) / 100).toFixed(2);
}

// the form itself; initial values come from props so it needs no effects
function TransactionForm({ accounts, categories, history, transaction }: FormData) {
  const db = useSQLiteContext();
  const [direction, setDirection] = useState<Direction>(transaction && transaction.amount < 0 ? 'in' : 'out');
  const [amountText, setAmountText] = useState(transaction ? centsToText(transaction.amount) : '');
  const [merchant, setMerchant] = useState(transaction?.merchantName ?? '');
  const [date, setDate] = useState(transaction?.date ?? new Date());
  const [accountId, setAccountId] = useState<string | null>(
    transaction ? (transaction.accountId ?? null) : (pickMainAccount(accounts)?.id ?? accounts[0]?.id ?? null),
  );
  // the user's own pick; undefined until they choose, so the suggestion can follow what they type
  const [pickedCategory, setPickedCategory] = useState<string | null | undefined>(
    transaction ? transaction.categoryId : undefined,
  );
  const [error, setError] = useState<string | null>(null);

  const cents = toCents(amountText);
  const valid = cents !== null && cents > 0;

  // a pick wins; otherwise suggest from the name, and money in defaults to the first income category
  const options = categoriesFor(categories, direction);
  const suggested = suggestCategoryId(history, options, merchant) ?? (direction === 'in' ? (options[0]?.id ?? null) : null);
  const chosen = pickedCategory === undefined ? suggested : pickedCategory;
  const categoryId = options.some((c) => c.id === chosen) ? chosen : null;

  // write the transaction and its balance change together, then close
  const save = async () => {
    if (!valid) return;
    const input = {
      accountId,
      amount: direction === 'out' ? cents : -cents,
      date,
      merchantName: merchant.trim() || null,
      categoryId,
    };
    try {
      if (transaction) await editTransaction(db, transaction.id, input);
      else await addTransaction(db, input);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // delete and put the amount back in the account
  const remove = async () => {
    if (!transaction) return;
    try {
      await deleteTransaction(db, transaction.id);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Sheet title={transaction ? 'Edit' : direction === 'out' ? 'Log spending' : 'Log money in'}>
      <Chips options={DIRECTIONS} value={direction} onChange={setDirection} />
      <AmountField label="How much?" value={amountText} onChangeText={setAmountText} autoFocus={!transaction} />
      <Field
        label={direction === 'out' ? 'Where?' : 'From?'}
        value={merchant}
        onChangeText={setMerchant}
        placeholder={direction === 'out' ? 'Tim Hortons' : 'Paycheque'}
      />
      <CategoryPicker categories={options} value={categoryId} onChange={setPickedCategory} />
      <DateField label="When?" value={date} onChange={setDate} />
      {accounts.length > 1 ? (
        <Chips
          label="Account"
          options={accounts.map((a) => ({ value: a.id, label: a.name }))}
          value={accountId}
          onChange={setAccountId}
        />
      ) : null}
      {error ? <Text className="font-sans-medium text-base text-ink">Couldn&apos;t save: {error}</Text> : null}
      <Button label={transaction ? 'Save' : 'Log it'} onPress={save} disabled={!valid} />
      {transaction ? <Button label="Delete" kind="plain" onPress={remove} /> : null}
    </Sheet>
  );
}

// log or edit a transaction (opened by the + button, or by tapping a row in Activity with ?id=)
export default function AddScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const load = useCallback((db: SQLiteDatabase) => loadForm(db, id), [id]);
  const { data, error } = useLiveQuery(load, false);

  if (error) return <Sheet title="Couldn't open this">{<Text className="font-sans text-base text-muted">{error.message}</Text>}</Sheet>;
  if (!data) return <Sheet title="">{null}</Sheet>;
  return <TransactionForm {...data} />;
}
