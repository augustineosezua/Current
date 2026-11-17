import { formatMoney, getTermPlanSummary, toCents } from '@current/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';

import { DateField } from '@/components/date-field';
import { AmountField, Button, Field, Sheet } from '@/components/form';
import { deleteTermPlan, saveTermPlan } from '@/db/plan';
import type { TermPlanRecord } from '@/db/records';
import * as repo from '@/db/repo';
import { useLiveQuery } from '@/hooks/use-live-query';
import { monthDayLabel } from '@/lib/format';
import { termPreset } from '@/lib/term';

// add or edit term money: a lump sum and the dates it has to last between
function TermPlanForm({ plan }: { plan: TermPlanRecord | null }) {
  const db = useSQLiteContext();
  const preset = termPreset();
  const [name, setName] = useState(plan?.name ?? '');
  const [amountText, setAmountText] = useState(plan ? (plan.amount / 100).toFixed(2) : '');
  const [startDate, setStartDate] = useState<Date | null>(plan?.startDate ?? null);
  const [endDate, setEndDate] = useState<Date | null>(plan?.endDate ?? null);
  const [error, setError] = useState<string | null>(null);

  const amount = toCents(amountText);
  const ordered = !!startDate && !!endDate && endDate.getTime() >= startDate.getTime();
  const valid = amount !== null && amount > 0 && ordered;

  // what the plan works out to, shown before saving
  const preview =
    valid && startDate && endDate
      ? getTermPlanSummary({ id: 'preview', name, amount, startDate, endDate, isActive: true }, new Date())
      : null;

  // run a write, close the sheet, and surface a failure instead of losing it
  const run = async (task: () => Promise<void>) => {
    try {
      await task();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // create or update; an empty name takes the storefront's preset
  const save = () =>
    run(async () => {
      if (!valid || !startDate || !endDate) return;
      await saveTermPlan(db, plan?.id ?? null, { name: name.trim() || preset.name, amount, startDate, endDate });
    });

  return (
    <Sheet title={plan ? 'Edit semester money' : 'Add semester money'}>
      <Text className="font-sans text-base leading-6 text-muted">{preset.hint}</Text>
      <Field label="What is it?" value={name} onChangeText={setName} placeholder={preset.name} />
      <AmountField label="How much?" value={amountText} onChangeText={setAmountText} autoFocus={!plan} />
      <DateField label="Starts" value={startDate} onChange={setStartDate} />
      <DateField label="Has to last until" value={endDate} onChange={setEndDate} />
      {startDate && endDate && !ordered ? (
        <Text className="font-sans-medium text-base text-ink">The end date needs to be after the start.</Text>
      ) : null}
      {preview ? (
        <Text className="font-sans-medium text-base leading-6 text-ink">
          That works out to about {formatMoney(preview.perWeek)} a week till {monthDayLabel(preview.endDate)}.
        </Text>
      ) : null}
      <Text className="font-sans text-base leading-6 text-muted">
        Once it hits your account, include it in your balance. We&apos;ll hold back the part that&apos;s for later weeks.
      </Text>
      {error ? <Text className="font-sans-medium text-base text-ink">That didn&apos;t save: {error}</Text> : null}
      <Button label="Save" onPress={save} disabled={!valid} />
      {plan ? <Button label="Delete semester money" kind="plain" onPress={() => run(() => deleteTermPlan(db, plan.id))} /> : null}
    </Sheet>
  );
}

// add-term-money sheet, or edit with ?id=
export default function TermPlanScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const load = useCallback(async (db: SQLiteDatabase) => ({ plan: id ? await repo.termPlans.get(db, id) : null }), [id]);
  const { data } = useLiveQuery(load, false);

  if (!data) return <Sheet title="">{null}</Sheet>;
  return <TermPlanForm plan={data.plan} />;
}
