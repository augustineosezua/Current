import type { StsResult } from '@current/core';
import { Link } from 'expo-router';
import { Pressable, Text } from 'react-native';

import type { BudgetData } from '@/db/sts';
import { budgetBannerLine, budgetStatuses } from '@/lib/budget-status';
import { usePlus } from '@/lib/plus';

// 2.3: one flat row per category past 90% of its limit this period ("$12 left in Food until Friday").
// Plain on purpose, like the stale-balance row: information, not an alarm.
export function BudgetBanners({ input, result }: { input: BudgetData; result: StsResult }) {
  const isPlus = usePlus();
  if (!isPlus || input.categoryBudgets.length === 0) return null;
  const flagged = budgetStatuses(input, result).filter((s) => s.threshold > 0);
  return (
    <>
      {flagged.map((s) => (
        <Link key={s.categoryId} href={{ pathname: '/category-budget', params: { categoryId: s.categoryId } }} asChild>
          <Pressable accessibilityRole="button" className="rounded-md bg-card p-4 active:opacity-70">
            <Text className="font-sans-medium text-base text-ink">{budgetBannerLine(s, input, result)}</Text>
          </Pressable>
        </Link>
      ))}
    </>
  );
}
