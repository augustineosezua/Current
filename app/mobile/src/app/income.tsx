import { getNextPaymentDate, toCents, type Frequency } from '@current/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';

import { DateField } from '@/components/date-field';
import { AmountField, Button, Chips, Field, Sheet } from '@/components/form';
import { deleteIncome, saveIncome } from '@/db/plan';
import type { IncomeRecord } from '@/db/records';
import * as repo from '@/db/repo';
import { useLiveQuery } from '@/hooks/use-live-query';
import { FREQUENCY_LABELS } from '@/lib/format';

const FREQUENCIES: readonly { value: Frequency; label: string }[] = (
  ['weekly', 'biweekly', 'semimonthly', 'monthly', 'one_time'] as const
).map((value) => ({ value, label: FREQUENCY_LABELS[value] }));

// add or edit a payday; the date shown is always the next one coming up
function IncomeForm({ income }: { income: IncomeRecord | null }) {
  const db = useSQLiteContext();
  const [name, setName] = useState(income?.name ?? '');
  const [amountText, setAmountText] = useState(income ? (income.amount / 100).toFixed(2) : '');
  const [frequency, setFrequency] = useState<Frequency>(income?.frequency ?? 'biweekly');
  const [date, setDate] = useState<Date | null>(income ? (getNextPaymentDate(income, new Date()) ?? income.nextPaymentDate) : null);
  const [error, setError] = useState<string | null>(null);

  const amount = toCents(amountText);
  const valid = amount !== null && amount > 0 && date !== null;

  // run a write, close the sheet, and surface a failure instead of losing it
  const run = async (task: () => Promise<void>) => {
    try {
      await task();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // create or update
  const save = () =>
    run(async () => {
      if (!valid) return;
      await saveIncome(db, income?.id ?? null, { name: name.trim() || null, amount, frequency, nextPaymentDate: date });
    });

  return (
    <Sheet title={income ? 'Edit payday' : 'Add a payday'}>
      <Field label="What is it?" value={name} onChangeText={setName} placeholder="Part-time job" />
      <AmountField label="How much?" value={amountText} onChangeText={setAmountText} autoFocus={!income} />
      <Chips label="How often?" options={FREQUENCIES} value={frequency} onChange={setFrequency} />
      <DateField label="Next payday" value={date} onChange={setDate} />
      <Text className="font-sans text-base leading-6 text-muted">
        This doesn&apos;t get added to your balance on its own. Log it with + when it comes in.
      </Text>
      {error ? <Text className="font-sans-medium text-base text-ink">That didn&apos;t save: {error}</Text> : null}
      <Button label="Save" onPress={save} disabled={!valid} />
      {income ? <Button label="Delete payday" kind="plain" onPress={() => run(() => deleteIncome(db, income.id))} /> : null}
    </Sheet>
  );
}

// add-payday sheet, or edit with ?id=
export default function IncomeScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const load = useCallback(async (db: SQLiteDatabase) => ({ income: id ? await repo.incomes.get(db, id) : null }), [id]);
  const { data } = useLiveQuery(load, false);

  if (!data) return <Sheet title="">{null}</Sheet>;
  return <IncomeForm income={data.income} />;
}
