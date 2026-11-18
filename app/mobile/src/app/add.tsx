import { applyModelParse, quickAdd, toCents } from '@current/core';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { CategoryPicker } from '@/components/category-picker';
import { DateField } from '@/components/date-field';
import { AmountField, Button, Chips, Field, Label, Sheet } from '@/components/form';
import { openPaywall, PlusTag } from '@/components/plus';
import { addTransaction, deleteTransaction, editTransaction, pickMainAccount } from '@/db/ledger';
import type { AccountRecord, CategoryRecord, TransactionRecord } from '@/db/records';
import * as repo from '@/db/repo';
import { useAi } from '@/hooks/use-ai';
import { useLiveQuery } from '@/hooks/use-live-query';
import { t, type MessageKey } from '@/i18n';
import { track } from '@/lib/analytics';
import { categoriesFor, categoryName, getSeeds, suggestCategoryId } from '@/lib/categories';
import { afterLogged } from '@/lib/milestones';
import { usePlus } from '@/lib/plus';

type Direction = 'out' | 'in';

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

export interface QuickFill {
  amount: number | null;
  merchantName: string | null;
  date: Date;
  categoryId: string | null;
}

// 2.1 (Plus): "coffee 4.50" fills the form. History first; the AI layer only when history can't settle it.
// Nothing is saved here: the user checks the filled-in form and taps Log it.
function QuickAdd({
  history,
  options,
  onFill,
}: {
  history: readonly TransactionRecord[];
  options: readonly CategoryRecord[];
  onFill: (fill: QuickFill) => void;
}) {
  const isPlus = usePlus();
  const ai = useAi();
  const muted = useCSSVariable('--color-muted') as string;
  const [text, setText] = useState('');
  const [status, setStatus] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);

  // free users see what it is, and tapping it opens the paywall
  if (!isPlus) {
    return (
      <Pressable onPress={() => openPaywall('quick-add')} accessibilityRole="button" className="gap-2 rounded-md bg-card p-4 active:opacity-70">
        <View className="flex-row items-center justify-between">
          <Label>{t('add.quickLabel')}</Label>
          <PlusTag />
        </View>
        <Text className="font-sans-medium text-lg text-muted">{t('add.quickPlaceholder')}</Text>
      </Pressable>
    );
  }

  const fill = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const now = new Date();
    const local = quickAdd(text, now, history, { seeds: getSeeds(), categoryIds: options.map((c) => c.id) });
    let result = local;
    let path: 'history' | 'on-device' | 'cloud' = 'history';
    if (local.needsModel && (ai.ready || ai.availability === 'needs-disclosure')) {
      const named = options.map((c) => ({ id: c.id, name: categoryName(c), kind: c.kind }));
      const answer = await ai.run({ task: 'parse', text, categories: named.map((c) => c.name) });
      if (answer) {
        result = applyModelParse(local, answer.result, named);
        path = answer.backend;
      }
    }
    onFill(result);
    track('quick_add', { path });
    setStatus(
      result.amount === null
        ? 'add.quickPartial'
        : path === 'on-device'
          ? 'add.quickOnDevice'
          : path === 'cloud'
            ? 'add.quickCloud'
            : result.needsModel
              ? 'add.quickNoAi'
              : 'add.quickHistory',
    );
    setBusy(false);
  };

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Label>{t('add.quickLabel')}</Label>
        <PlusTag />
      </View>
      <View className="flex-row items-center gap-2">
        <TextInput
          value={text}
          onChangeText={(s) => {
            setText(s);
            setStatus(null);
          }}
          placeholder={t('add.quickPlaceholder')}
          placeholderTextColor={muted}
          returnKeyType="done"
          onSubmitEditing={() => void fill()}
          accessibilityLabel={t('add.quickLabel')}
          className="min-h-13 flex-1 rounded-sm bg-field px-4 font-sans-medium text-lg text-ink"
        />
        <Pressable
          onPress={() => void fill()}
          disabled={busy || !text.trim()}
          accessibilityRole="button"
          className={`min-h-13 justify-center rounded-full bg-cta px-4 ${busy || !text.trim() ? 'opacity-40' : ''}`}>
          <Text className="font-sans-bold text-base text-on-cta">{busy ? t('add.quickFilling') : t('add.quickFill')}</Text>
        </Pressable>
      </View>
      {status ? <Text className="font-sans text-sm leading-5 text-muted">{t(status)}</Text> : null}
    </View>
  );
}

// the form itself; initial values come from props so it needs no effects
function TransactionForm({ accounts, categories, history, transaction, startIn }: FormData & { startIn: boolean }) {
  const db = useSQLiteContext();
  const [direction, setDirection] = useState<Direction>(transaction ? (transaction.amount < 0 ? 'in' : 'out') : startIn ? 'in' : 'out');
  const [amountText, setAmountText] = useState(transaction ? centsToText(transaction.amount) : '');
  const [merchant, setMerchant] = useState(transaction?.merchantName ?? '');
  const [date, setDate] = useState(transaction?.date ?? new Date());
  // the date field reads its starting month once, so a quick-add date remounts it
  const [dateKey, setDateKey] = useState(0);
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
  const directions = [
    { value: 'out', label: t('add.spent') },
    { value: 'in', label: t('add.gotPaid') },
  ] as const;

  // a pick wins; otherwise suggest from the name, and money in defaults to the first income category
  const options = categoriesFor(categories, direction);
  const suggested = suggestCategoryId(history, options, merchant) ?? (direction === 'in' ? (options[0]?.id ?? null) : null);
  const chosen = pickedCategory === undefined ? suggested : pickedCategory;
  const categoryId = options.some((c) => c.id === chosen) ? chosen : null;

  // quick add fills the fields it found, leaving the rest as they were
  const applyFill = (fill: QuickFill) => {
    if (fill.amount !== null) setAmountText(centsToText(fill.amount));
    if (fill.merchantName) setMerchant(fill.merchantName);
    setDate(fill.date);
    setDateKey((k) => k + 1);
    if (fill.categoryId) setPickedCategory(fill.categoryId);
  };

  // write the transaction and its balance change together, then close (or offer the trial at activation)
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
      const milestone = transaction ? null : await afterLogged(db).catch(() => null);
      if (milestone === 'trial') router.replace({ pathname: '/plus', params: { from: 'activation' } });
      else router.back();
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
    <Sheet title={transaction ? t('add.edit') : direction === 'out' ? t('add.logSpending') : t('add.logIn')}>
      {!transaction && direction === 'out' ? <QuickAdd history={history} options={options} onFill={applyFill} /> : null}
      <Chips options={directions} value={direction} onChange={setDirection} />
      <AmountField label={t('common.howMuch')} value={amountText} onChangeText={setAmountText} autoFocus={!transaction} />
      <Field
        label={direction === 'out' ? t('add.where') : t('add.from')}
        value={merchant}
        onChangeText={setMerchant}
        placeholder={direction === 'out' ? t('add.wherePlaceholder') : t('add.fromPlaceholder')}
      />
      <CategoryPicker categories={options} value={categoryId} onChange={setPickedCategory} />
      <DateField key={dateKey} label={t('add.when')} value={date} onChange={setDate} />
      {accounts.length > 1 ? (
        <Chips
          label={t('common.account')}
          options={accounts.map((a) => ({ value: a.id, label: a.name }))}
          value={accountId}
          onChange={setAccountId}
        />
      ) : null}
      {error ? <Text className="font-sans-medium text-base text-ink">{t('common.didntSave', { error })}</Text> : null}
      <Button label={transaction ? t('common.save') : t('add.logIt')} onPress={save} disabled={!valid} />
      {transaction ? <Button label={t('common.delete')} kind="plain" onPress={remove} /> : null}
    </Sheet>
  );
}

// log or edit a transaction (opened by the + button, ?direction=in from its menu, or a row in Activity with ?id=)
export default function AddScreen() {
  const { id, direction } = useLocalSearchParams<{ id?: string; direction?: string }>();
  const load = useCallback((db: SQLiteDatabase) => loadForm(db, id), [id]);
  const { data, error } = useLiveQuery(load, false);

  if (error) return <Sheet title={t('add.openError')}>{<Text className="font-sans text-base text-muted">{error.message}</Text>}</Sheet>;
  if (!data) return <Sheet title="">{null}</Sheet>;
  return <TransactionForm {...data} startIn={direction === 'in'} />;
}
