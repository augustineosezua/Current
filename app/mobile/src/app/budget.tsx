import { defaultBudgetPeriod, formatMoney, getNextPaymentDate, type BudgetPeriodKind } from '@current/core';
import { Link, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, Text, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { Button, Chips } from '@/components/form';
import { Raised } from '@/components/raised';
import { Screen } from '@/components/screen';
import { setBudgetPeriod } from '@/db/plan';
import type { IncomeRecord } from '@/db/records';
import { useSafeToSpend } from '@/db/sts';
import { dayLabel, FREQUENCY_LABELS, monthDayLabel } from '@/lib/format';

const PERIODS: readonly { value: BudgetPeriodKind; label: string }[] = [
  { value: 'paycheque', label: 'By paycheque' },
  { value: 'monthly', label: 'By month' },
  { value: 'term', label: 'By term' },
];

// what's missing when the chosen period can't be used yet
const MISSING: Record<BudgetPeriodKind, string> = {
  paycheque: 'Add a payday below to budget by paycheque. Until then we go by month.',
  term: 'Add term money on the Plan tab to budget by term. Until then we go by month.',
  monthly: '',
};

// one payday; tapping opens it for editing
function IncomeRow({ income, now }: { income: IncomeRecord; now: Date }) {
  const next = getNextPaymentDate(income, now);
  const when = next ? `Next ${dayLabel(next, now)}` : 'No upcoming payday';
  return (
    <Link href={{ pathname: '/income', params: { id: income.id } }} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${income.name ?? 'Payday'}, ${formatMoney(income.amount)}, ${when}. Edit`}
        className="min-h-16 flex-row items-center gap-3 px-4 py-2 active:opacity-70">
        <View className="flex-1">
          <Text className="font-sans-bold text-base text-ink" numberOfLines={1}>
            {income.name ?? 'Payday'}
          </Text>
          <Text className="font-sans text-sm text-muted">
            {when} · {FREQUENCY_LABELS[income.frequency].toLowerCase()}
          </Text>
        </View>
        <Text className="font-display-bold text-lg tabular-nums text-ink">{formatMoney(income.amount)}</Text>
      </Pressable>
    </Link>
  );
}

// how the budget is split up, and the paydays it runs between
export default function BudgetScreen() {
  const db = useSQLiteContext();
  const { input, result } = useSafeToSpend();
  const now = new Date();

  if (!input || !result) return <Screen header={<BackButton />} title="Budget">{null}</Screen>;

  const chosen = input.settings.budgetPeriod ?? defaultBudgetPeriod(input.incomes, now);
  const period = result.period;

  return (
    <Screen header={<BackButton />} title="Budget">
      <Raised>
        <View className="gap-4 p-5">
          <Chips label="Budget" options={PERIODS} value={chosen} onChange={(kind) => void setBudgetPeriod(db, kind)} />
          <Text className="font-sans text-base leading-6 text-muted">
            {period.kind === chosen
              ? `Right now that's ${monthDayLabel(period.start)} to ${monthDayLabel(period.end)}.`
              : MISSING[chosen]}
          </Text>
        </View>
      </Raised>

      <Text className="font-display-bold text-xl text-ink">Paydays</Text>
      {input.incomes.length > 0 ? (
        <Raised>
          <View className="py-1">
            {input.incomes.map((i) => (
              <IncomeRow key={i.id} income={i} now={now} />
            ))}
          </View>
        </Raised>
      ) : (
        <Text className="font-sans text-base leading-6 text-muted">
          No paydays yet. Add one and your daily number runs from one payday to the next.
        </Text>
      )}
      <Button label="Add a payday" kind="secondary" onPress={() => router.push('/income')} />
    </Screen>
  );
}
