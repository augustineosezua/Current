import { getWeeklyTotals } from '@current/core';

import type { BudgetData } from '@/db/sts';
import { t } from '@/i18n';
import { money, monthDayLabel } from '@/lib/format';

import { BarChart, ChartCard } from './charts';

// eight weekly spending bars, oldest on the left, this week in ink (Insights, Plus)
export function WeekBars({ input, now }: { input: BudgetData; now: Date }) {
  const weeks = getWeeklyTotals(input.transactions, input.categories, now, 8);
  return (
    <ChartCard title={t('insights.weeks')}>
      <BarChart
        bars={weeks.map((w) => ({ key: String(w.start.getTime()), value: w.amount, label: String(w.start.getDate()) }))}
        highlight={weeks.length - 1}
        a11y={weeks.map((w) => t('insights.weekOf', { date: monthDayLabel(w.start), amount: money(w.amount) })).join('. ')}
      />
    </ChartCard>
  );
}
