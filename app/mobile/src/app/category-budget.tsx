import { defaultBudgetPeriod, toCents } from '@current/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { CategoryPicker } from '@/components/category-picker';
import { AmountField, Button, Sheet } from '@/components/form';
import { deleteCategoryBudget, saveCategoryBudget } from '@/db/budgets';
import { loadStsInput, type BudgetData } from '@/db/sts';
import { useLiveQuery } from '@/hooks/use-live-query';
import { t } from '@/i18n';
import { categoriesFor } from '@/lib/categories';
import { periodNoun, periodPhrase } from '@/lib/format';

// set or change one category's limit, and whether what's left rolls over
function LimitForm({ data, categoryId: initial }: { data: BudgetData; categoryId: string | undefined }) {
  const db = useSQLiteContext();
  const existing = data.categoryBudgets.find((b) => b.categoryId === initial) ?? null;
  const [categoryId, setCategoryId] = useState<string | null>(initial ?? null);
  const [amountText, setAmountText] = useState(existing ? (existing.limit / 100).toFixed(2) : '');
  const [rollover, setRollover] = useState(existing?.rollover ?? false);
  const [error, setError] = useState<string | null>(null);

  // the period kind the budget runs on, for "Limit per paycheque"
  const kind = data.settings.budgetPeriod ?? defaultBudgetPeriod(data.incomes, new Date());
  const amount = toCents(amountText);
  const valid = !!categoryId && amount !== null && amount > 0;
  // spending categories only; savings moves and income never count as spending
  const options = categoriesFor(data.categories, 'out').filter((c) => c.kind === 'needs' || c.kind === 'wants');

  const run = async (task: () => Promise<void>) => {
    try {
      await task();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Sheet title={existing ? t('limit.edit') : t('limit.add')}>
      <CategoryPicker categories={options} value={categoryId} onChange={setCategoryId} />
      <AmountField label={t('limit.amount', { period: periodNoun(kind) })} value={amountText} onChangeText={setAmountText} />
      <View className="flex-row items-center gap-3 rounded-md bg-card p-4">
        <View className="flex-1 gap-1">
          <Text className="font-sans-bold text-base text-ink">{t('limit.rollover')}</Text>
          <Text className="font-sans text-sm leading-5 text-muted">
            {t('limit.rolloverBody', { nextPeriod: periodPhrase(kind, 'next') })}
          </Text>
        </View>
        <Switch value={rollover} onValueChange={setRollover} accessibilityLabel={t('limit.rollover')} />
      </View>
      <Text className="font-sans text-sm leading-5 text-muted">{t('plan.limitsNote')}</Text>
      {error ? <Text className="font-sans-medium text-base text-ink">{t('common.didntSave', { error })}</Text> : null}
      <Button
        label={t('common.save')}
        disabled={!valid}
        onPress={() => void run(() => saveCategoryBudget(db, { categoryId: categoryId!, limit: amount!, rollover }))}
      />
      {existing ? (
        <Button label={t('limit.remove')} kind="plain" onPress={() => void run(() => deleteCategoryBudget(db, existing.categoryId))} />
      ) : null}
    </Sheet>
  );
}

// add-limit sheet, or edit with ?categoryId=
export default function CategoryBudgetScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();
  const load = useCallback((db: SQLiteDatabase) => loadStsInput(db), []);
  const { data } = useLiveQuery(load, false);
  if (!data) return <Sheet title="">{null}</Sheet>;
  return <LimitForm data={data} categoryId={categoryId} />;
}
