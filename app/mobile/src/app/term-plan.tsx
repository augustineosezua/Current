import { getTermPlanSummary, toCents } from '@current/core';
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
import { t } from '@/i18n';
import { money, monthDayLabel } from '@/lib/format';
import { afterTermPlan } from '@/lib/milestones';
import { usePlus } from '@/lib/plus';
import { termPreset } from '@/lib/term';

// add or edit term money: a lump sum and the dates it has to last between
function TermPlanForm({ plan }: { plan: TermPlanRecord | null }) {
  const db = useSQLiteContext();
  const preset = termPreset();
  const isPlus = usePlus();
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

  // create or update; an empty name takes the storefront's preset. A first plan can bring the trial offer (2.0)
  const save = async () => {
    if (!valid || !startDate || !endDate) return;
    try {
      await saveTermPlan(db, plan?.id ?? null, { name: name.trim() || preset.name, amount, startDate, endDate }, new Date(), isPlus);
      const milestone = plan ? null : await afterTermPlan(db).catch(() => null);
      if (milestone === 'trial') router.replace({ pathname: '/plus', params: { from: 'activation' } });
      else router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Sheet title={plan ? t('term.edit') : t('term.add')}>
      <Text className="font-sans text-base leading-6 text-muted">{preset.hint}</Text>
      <Field label={t('common.whatIsIt')} value={name} onChangeText={setName} placeholder={preset.name} />
      <AmountField label={t('common.howMuch')} value={amountText} onChangeText={setAmountText} autoFocus={!plan} />
      <DateField label={t('term.starts')} value={startDate} onChange={setStartDate} />
      <DateField label={t('term.until')} value={endDate} onChange={setEndDate} />
      {startDate && endDate && !ordered ? (
        <Text className="font-sans-medium text-base text-ink">{t('error.endAfterStart')}</Text>
      ) : null}
      {preview ? (
        <Text className="font-sans-medium text-base leading-6 text-ink">
          {t('term.preview', { amount: money(preview.perWeek), date: monthDayLabel(preview.endDate) })}
        </Text>
      ) : null}
      <Text className="font-sans text-base leading-6 text-muted">
        {t('term.note')}
      </Text>
      {error ? <Text className="font-sans-medium text-base text-ink">{t('common.didntSave', { error })}</Text> : null}
      <Button label={t('common.save')} onPress={() => void save()} disabled={!valid} />
      {plan ? <Button label={t('term.delete')} kind="plain" onPress={() => run(() => deleteTermPlan(db, plan.id))} /> : null}
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
