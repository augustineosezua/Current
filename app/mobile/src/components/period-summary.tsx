import { getPreviousPeriod, summarizePeriod, type BudgetPeriodKind, type PeriodComparison, type StsResult } from '@current/core';
import { Text, View } from 'react-native';

import type { BudgetData } from '@/db/sts';
import { t } from '@/i18n';
import { categoryName, fillFor, UNCATEGORIZED } from '@/lib/categories';
import { money, monthDayLabel, periodPhrase } from '@/lib/format';

import { Raised } from './raised';
import { Sticker } from './sticker';

const MAX_ROWS = 6;

// "12% less than this point last paycheque": day N against day N, stated as a plain fact
export function comparisonLine(comparison: PeriodComparison | null, kind: BudgetPeriodKind): string | null {
  const pct = comparison?.changePercent;
  if (pct == null) return null;
  const lastPeriod = periodPhrase(kind, 'last');
  if (pct === 0) return t('summary.same', { lastPeriod });
  return t(pct < 0 ? 'summary.less' : 'summary.more', { pct: Math.abs(pct), lastPeriod });
}

// spending so far this budget period: the total, a like-for-like line and where it went
export function PeriodSummary({ input, result }: { input: BudgetData; result: StsResult }) {
  const period = result.period;
  const previous = getPreviousPeriod(period, input.settings, input.incomes, input.termPlans);
  const summary = summarizePeriod(input.transactions, input.categories, period, previous, new Date());
  const categories = new Map(input.categories.map((c) => [c.id, c]));
  const compared = comparisonLine(summary.comparison, period.kind);

  // biggest categories, with the tail folded into one row
  const rows = summary.byCategory.slice(0, MAX_ROWS);
  const rest = summary.byCategory.slice(MAX_ROWS).reduce((sum, c) => sum + c.amount, 0);

  return (
    <Raised>
      <View className="gap-3 p-5">
        <View className="gap-1">
          <Text className="font-sans-bold text-sm text-muted">
            {t('summary.heading', {
              thisPeriod: periodPhrase(period.kind, 'this'),
              start: monthDayLabel(period.start),
              end: monthDayLabel(period.end),
            })}
          </Text>
          <Text className="font-display text-3xl tabular-nums text-ink">
            {money(summary.total)} <Text className="font-display-bold text-lg">{t('summary.spent')}</Text>
          </Text>
          {compared ? <Text className="font-sans-medium text-base text-ink">{compared}</Text> : null}
          {summary.total === 0 ? (
            <Text className="font-sans text-base text-muted">{t('summary.none', { thisPeriod: periodPhrase(period.kind, 'thisLower') })}</Text>
          ) : null}
        </View>

        {rows.map((row) => {
          const category = row.categoryId ? categories.get(row.categoryId) : null;
          const sticker = category ? { emoji: category.emoji, fill: fillFor(category.color) } : UNCATEGORIZED;
          const share = Math.round((row.amount * 100) / summary.total);
          return (
            <View key={row.categoryId ?? 'none'} className="flex-row items-center gap-3">
              <Sticker emoji={sticker.emoji} fill={sticker.fill} size="sm" />
              <Text className="flex-1 font-sans-medium text-base text-ink" numberOfLines={1}>
                {category ? categoryName(category) : t('common.uncategorized')}
              </Text>
              <Text className="font-sans text-sm tabular-nums text-muted">{share}%</Text>
              <Text className="min-w-20 text-right font-display-bold text-base tabular-nums text-ink">{money(row.amount)}</Text>
            </View>
          );
        })}
        {rest > 0 ? (
          <View className="flex-row items-center justify-between">
            <Text className="font-sans-medium text-base text-muted">{t('summary.everythingElse')}</Text>
            <Text className="font-display-bold text-base tabular-nums text-ink">{money(rest)}</Text>
          </View>
        ) : null}
      </View>
    </Raised>
  );
}
