import { formatMoney, toCents, type Frequency } from '@current/core';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { CategoryPicker } from '@/components/category-picker';
import { DateField } from '@/components/date-field';
import { AmountField, Button, Chips, Field, Sheet } from '@/components/form';
import { useToast } from '@/components/toast';
import { createBill, deleteBill, markBillPaid, markBillUnpaid, pickMainAccount, updateBill } from '@/db/ledger';
import type { AccountRecord, BillRecord, CategoryRecord } from '@/db/records';
import * as repo from '@/db/repo';
import { useLiveQuery } from '@/hooks/use-live-query';
import { categoriesFor, suggestCategoryId } from '@/lib/categories';
import { FREQUENCY_LABELS } from '@/lib/format';

const REPEATS: readonly { value: Frequency; label: string }[] = (
  ['one_time', 'weekly', 'biweekly', 'monthly', 'yearly'] as const
).map((value) => ({ value, label: FREQUENCY_LABELS[value] }));

interface FormData {
  bill: BillRecord | null;
  accounts: AccountRecord[];
  categories: CategoryRecord[];
}

// the bill being edited, the accounts a payment can come from and the categories it can be filed under
async function loadForm(db: SQLiteDatabase, id: string | undefined): Promise<FormData> {
  const [bill, accounts, categories] = await Promise.all([
    id ? repo.bills.get(db, id) : null,
    repo.accounts.list(db),
    repo.categories.list(db),
  ]);
  return { bill, accounts, categories: categoriesFor(categories, 'out') };
}

// add or edit a bill; an existing unpaid bill can also be marked paid on a chosen date from a chosen account
function BillForm({ bill, accounts, categories }: FormData) {
  const db = useSQLiteContext();
  const toast = useToast();
  const spendable = accounts.filter((a) => a.type !== 'savings');
  const [name, setName] = useState(bill?.name ?? '');
  const [amountText, setAmountText] = useState(bill ? (bill.amount / 100).toFixed(2) : '');
  const [dueDate, setDueDate] = useState<Date | null>(bill?.dueDate ?? null);
  const [frequency, setFrequency] = useState<Frequency>(bill?.frequency ?? (bill ? 'one_time' : 'monthly'));
  const [paidOn, setPaidOn] = useState(new Date());
  const [payFrom, setPayFrom] = useState<string | null>(bill?.accountId ?? pickMainAccount(accounts)?.id ?? null);
  // the user's own pick; undefined until they choose, so the suggestion can follow the name
  const [pickedCategory, setPickedCategory] = useState<string | null | undefined>(bill ? bill.categoryId : undefined);
  const [error, setError] = useState<string | null>(null);

  // a pick wins; otherwise suggest from the name, falling back to "Rent & bills"
  const fallback = categories.find((c) => c.id === 'default-home')?.id ?? null;
  const chosen = pickedCategory === undefined ? (suggestCategoryId([], categories, name) ?? fallback) : pickedCategory;
  const categoryId = categories.some((c) => c.id === chosen) ? chosen : null;

  const amount = toCents(amountText);
  const valid = name.trim().length > 0 && amount !== null && amount > 0 && dueDate !== null;

  // run a write, close the sheet, and surface a failure instead of losing it
  const run = async (task: () => Promise<void>) => {
    try {
      await task();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // create or update the bill's details
  const save = () =>
    run(async () => {
      if (!valid) return;
      const input = { name: name.trim(), amount, dueDate, frequency, accountId: bill?.accountId, categoryId };
      if (bill) await updateBill(db, bill.id, input);
      else await createBill(db, input);
    });

  // log the payment and offer to undo it
  const pay = () =>
    run(async () => {
      if (!bill) return;
      const paid = await markBillPaid(db, bill.id, { date: paidOn, accountId: payFrom });
      if (!paid) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      toast({
        message: `Logged ${formatMoney(paid.amount)} from ${paid.name}`,
        actionLabel: 'Undo',
        onAction: () => void markBillUnpaid(db, bill.id),
      });
    });

  return (
    <Sheet title={bill ? 'Edit bill' : 'Add a bill'}>
      <Field label="What is it?" value={name} onChangeText={setName} placeholder="Rent" autoFocus={!bill} />
      <AmountField label="How much?" value={amountText} onChangeText={setAmountText} />
      <DateField label="Next due" value={dueDate} onChange={setDueDate} />
      <Chips label="Repeats" options={REPEATS} value={frequency} onChange={setFrequency} />
      <CategoryPicker categories={categories} value={categoryId} onChange={setPickedCategory} />
      {error ? <Text className="font-sans-medium text-base text-ink">Couldn&apos;t save: {error}</Text> : null}
      <Button label="Save" onPress={save} disabled={!valid} />

      {bill && !bill.isPaid ? (
        <View className="gap-5 border-t-2 border-field pt-5">
          <Text className="font-display-bold text-xl text-ink">Paid it?</Text>
          <DateField label="Paid on" value={paidOn} onChange={setPaidOn} />
          {spendable.length > 1 ? (
            <Chips
              label="From"
              options={spendable.map((a) => ({ value: a.id, label: a.name }))}
              value={payFrom}
              onChange={setPayFrom}
            />
          ) : null}
          <Button label="Mark paid" kind="secondary" onPress={pay} />
        </View>
      ) : null}
      {bill?.isPaid ? (
        <Button label="Mark unpaid" kind="secondary" onPress={() => run(() => markBillUnpaid(db, bill.id))} />
      ) : null}
      {bill ? <Button label="Delete bill" kind="plain" onPress={() => run(() => deleteBill(db, bill.id))} /> : null}
    </Sheet>
  );
}

// add-bill sheet, or edit with ?id=
export default function BillScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const load = useCallback((db: SQLiteDatabase) => loadForm(db, id), [id]);
  const { data } = useLiveQuery(load, false);

  if (!data) return <Sheet title="">{null}</Sheet>;
  return <BillForm {...data} />;
}
