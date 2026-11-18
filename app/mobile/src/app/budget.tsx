import { daysBetween, defaultBudgetPeriod, getNextPaymentDate, type BudgetPeriodKind } from '@current/core';
import { Link, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { DateField } from '@/components/date-field';
import { Button, Chips } from '@/components/form';
import { Raised } from '@/components/raised';
import { Screen } from '@/components/screen';
import { saveSetting, setBudgetEnd, setBudgetPeriod } from '@/db/plan';
import type { IncomeRecord, Settings } from '@/db/records';
import { useSafeToSpend } from '@/db/sts';
import { t } from '@/i18n';
import { dayLabel, frequencyLabel, money, monthDayLabel } from '@/lib/format';

const PERIODS: readonly { value: BudgetPeriodKind; label: string }[] = [
  { value: 'paycheque', label: t('budget.byPaycheque') },
  { value: 'monthly', label: t('budget.byMonth') },
  { value: 'term', label: t('budget.byTerm') },
];

// what the big number on Home shows
const HERO_OPTIONS: readonly { value: Settings['heroAmount']; label: string }[] = [
  { value: 'perDay', label: t('budget.heroPerDay') },
  { value: 'total', label: t('budget.heroTotal') },
];

// what's missing when the chosen period can't be used yet
const MISSING: Record<BudgetPeriodKind, string> = {
  paycheque: t('budget.missingPaycheque'),
  term: t('budget.missingTerm'),
  monthly: '',
};

// one payday; tapping opens it for editing
function IncomeRow({ income, now }: { income: IncomeRecord; now: Date }) {
  const next = getNextPaymentDate(income, now);
  const when = next ? t('budget.next', { day: dayLabel(next, now) }) : t('budget.noUpcoming');
  const name = income.name ?? t('budget.payday');
  return (
    <Link href={{ pathname: '/income', params: { id: income.id } }} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.edit', { label: `${name}, ${money(income.amount)}, ${when}` })}
        className="min-h-16 flex-row items-center gap-3 px-4 py-2 active:opacity-70">
        <View className="flex-1">
          <Text className="font-sans-bold text-base text-ink" numberOfLines={1}>
            {name}
          </Text>
          <Text className="font-sans text-sm text-muted">
            {when} · {frequencyLabel(income.frequency).toLowerCase()}
          </Text>
        </View>
        <Text className="font-display-bold text-lg tabular-nums text-ink">{money(income.amount)}</Text>
      </Pressable>
    </Link>
  );
}

// when the current budget ends; pick a day to end it early or stretch it, or go back to the normal end
function BudgetEndCard({ end, picked }: { end: Date; picked: boolean }) {
  const db = useSQLiteContext();
  const [error, setError] = useState<string | null>(null);

  // save straight away; the number on Home follows
  const pick = (day: Date) => {
    setError(null);
    setBudgetEnd(db, day).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  };

  return (
    <Raised>
      <View className="gap-3 p-5">
        <DateField key={end.getTime()} label={t('budget.ends')} value={end} onChange={pick} minDate={new Date()} />
        <Text className="font-sans text-base leading-6 text-muted">
          {picked ? t('budget.endsPicked') : t('budget.endsHint')}
        </Text>
        {error ? <Text className="font-sans-medium text-base text-ink">{error}</Text> : null}
        {picked ? <Button label={t('budget.endsReset')} kind="secondary" onPress={() => void setBudgetEnd(db, null)} /> : null}
      </View>
    </Raised>
  );
}

// how the budget is split up, and the paydays it runs between
export default function BudgetScreen() {
  const db = useSQLiteContext();
  const { input, result } = useSafeToSpend();
  const now = new Date();

  if (!input || !result) return <Screen header={<BackButton />} title={t('budget.title')}>{null}</Screen>;

  const chosen = input.settings.budgetPeriod ?? defaultBudgetPeriod(input.incomes, now);
  const period = result.period;
  // a picked end day only counts until it has passed
  const override = input.settings.periodEndOverride;
  const picked = !!override && daysBetween(now, override) >= 0;

  return (
    <Screen header={<BackButton />} title={t('budget.title')}>
      <Raised>
        <View className="gap-3 p-5">
          <Chips label={t('budget.title')} options={PERIODS} value={chosen} onChange={(kind) => void setBudgetPeriod(db, kind)} />
          <Text className="font-sans text-base leading-6 text-muted">
            {period.kind === chosen
              ? t('budget.rightNow', { start: monthDayLabel(period.start), end: monthDayLabel(period.end) })
              : MISSING[chosen]}
          </Text>
        </View>
      </Raised>

      <BudgetEndCard end={period.end} picked={picked} />

      <Raised>
        <View className="gap-3 p-5">
          <Chips
            label={t('budget.heroShows')}
            options={HERO_OPTIONS}
            value={input.settings.heroAmount}
            onChange={(value) => void saveSetting(db, 'heroAmount', value)}
          />
          <Text className="font-sans text-base leading-6 text-muted">{t('budget.heroHint')}</Text>
        </View>
      </Raised>

      <Text className="font-display-bold text-xl text-ink">{t('budget.paydays')}</Text>
      {input.incomes.length > 0 ? (
        <Raised>
          <View className="py-1">
            {input.incomes.map((i) => (
              <IncomeRow key={i.id} income={i} now={now} />
            ))}
          </View>
        </Raised>
      ) : (
        <Text className="font-sans text-base leading-6 text-muted">{t('budget.noPaydays')}</Text>
      )}
      <Button label={t('budget.addPayday')} kind="secondary" onPress={() => router.push('/income')} />
    </Screen>
  );
}
