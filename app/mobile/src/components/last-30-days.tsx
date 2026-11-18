import { addDays, getDailySpending, startOfDay } from '@current/core';
import type { ReactNode } from 'react';

import type { BudgetData } from '@/db/sts';
import { t } from '@/i18n';
import { money, monthDayLabel, shortDate } from '@/lib/format';

import { ChartCard, LineChart } from './charts';

// the one free chart, on Home: what was spent each day for the last 30 days, as a line
export function Last30Days({ input, now, footer }: { input: BudgetData; now: Date; footer?: ReactNode }) {
  const end = startOfDay(now);
  const start = addDays(end, -29);
  const days = getDailySpending(input.transactions, input.categories, start, end);
  const total = days.reduce((s, d) => s + d.amount, 0);
  const peak = days.reduce((a, b) => (b.amount > a.amount ? b : a), days[0]!);
  return (
    <ChartCard title={t('chart.last30')} line={t('chart.last30Line', { total: money(total), perDay: money(Math.round(total / days.length)) })}>
      <LineChart
        series={[{ values: days.map((d) => d.amount), color: '--color-cta', fill: true }]}
        startLabel={monthDayLabel(start)}
        endLabel={t('chart.today')}
        a11y={t('chart.last30A11y', { total: money(total), amount: money(peak.amount), date: shortDate(peak.date) })}
      />
      {footer}
    </ChartCard>
  );
}
