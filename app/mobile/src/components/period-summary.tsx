import { formatMoney, getPreviousPeriod, summarizePeriod, type PeriodComparison, type StsResult } from '@current/core';
import { Text, View } from 'react-native';

import type { BudgetData } from '@/db/sts';
import { fillFor, UNCATEGORIZED } from '@/lib/categories';
import { monthDayLabel, PERIOD_NOUNS } from '@/lib/format';

import { Raised } from './raised';
import { Sticker } from './sticker';

const MAX_ROWS = 6;

// "12% less than this point last paycheque": day N against day N, stated as a plain fact
export function comparisonLine(comparison: PeriodComparison | null, noun: string): string | null {
  const pct = comparison?.changePercent;
  if (pct == null) return null;
  if (pct === 0) return `About the same as this point last ${noun}`;
  return `${Math.abs(pct)}% ${pct < 0 ? 'less' : 'more'} than this point last ${noun}`;
}

// spending so far this budget period: the total, a like-for-like line and where it went
export function PeriodSummary({ input, result }: { input: BudgetData; result: StsResult }) {
  const period = result.period;
  const noun = PERIOD_NOUNS[period.kind];
  const previous = getPreviousPeriod(period, input.settings, input.incomes, input.termPlans);
  const summary = summarizePeriod(input.transactions, input.categories, period, previous, new Date());
  const categories = new Map(input.categories.map((c) => [c.id, c]));
  const compared = comparisonLine(summary.comparison, noun);

  // biggest categories, with the tail folded into one row
  const rows = summary.byCategory.slice(0, MAX_ROWS);
  const rest = summary.byCategory.slice(MAX_ROWS).reduce((sum, c) => sum + c.amount, 0);

  return (
    <Raised>
      <View className="gap-3 p-5">
        <View className="gap-1">
          <Text className="font-sans-bold text-sm text-muted">
            This {noun} · {monthDayLabel(period.start)} to {monthDayLabel(period.end)}
          </Text>
          <Text className="font-display text-3xl tabular-nums text-ink">
            {formatMoney(summary.total)} <Text className="font-display-bold text-lg">spent</Text>
          </Text>
          {compared ? <Text className="font-sans-medium text-base text-ink">{compared}</Text> : null}
          {summary.total === 0 ? <Text className="font-sans text-base text-muted">Nothing spent yet this {noun}.</Text> : null}
        </View>

        {rows.map((row) => {
          const category = row.categoryId ? categories.get(row.categoryId) : null;
          const sticker = category ? { emoji: category.emoji, fill: fillFor(category.color) } : UNCATEGORIZED;
          const share = Math.round((row.amount * 100) / summary.total);
          return (
            <View key={row.categoryId ?? 'none'} className="flex-row items-center gap-3">
              <Sticker emoji={sticker.emoji} fill={sticker.fill} size="sm" />
              <Text className="flex-1 font-sans-medium text-base text-ink" numberOfLines={1}>
                {category?.name ?? 'Uncategorized'}
              </Text>
              <Text className="font-sans text-sm tabular-nums text-muted">{share}%</Text>
              <Text className="min-w-20 text-right font-display-bold text-base tabular-nums text-ink">{formatMoney(row.amount)}</Text>
            </View>
          );
        })}
        {rest > 0 ? (
          <View className="flex-row items-center justify-between">
            <Text className="font-sans-medium text-base text-muted">Everything else</Text>
            <Text className="font-display-bold text-base tabular-nums text-ink">{formatMoney(rest)}</Text>
          </View>
        ) : null}
      </View>
    </Raised>
  );
}
