import {
  addDays,
  addMonthsClamped,
  compareCategories,
  cumulative,
  daysBetween,
  getDailySpending,
  getMonthlyTotals,
  getPreviousPeriod,
  getTopMerchants,
  getWeekdayAverages,
  inclusiveDays,
  isSameDay,
  previousRange,
  startOfDay,
  startOfMonth,
  type DayRange,
  type Period,
} from '@current/core';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { BackButton } from '@/components/back-button';
import { BarChart, ChartCard, Donut, Legend, LineChart, RankBars, type DonutSlice } from '@/components/charts';
import { Chips } from '@/components/form';
import { PlusTeaser } from '@/components/plus';
import { Raised } from '@/components/raised';
import { Screen } from '@/components/screen';
import { Sticker } from '@/components/sticker';
import { WeekBars } from '@/components/week-bars';
import { useSafeToSpend, type BudgetData } from '@/db/sts';
import { LOCALE, t } from '@/i18n';
import { categoryName, fillFor, UNCATEGORIZED } from '@/lib/categories';
import { money, monthDayLabel, monthLabel, periodPhrase, shortDate } from '@/lib/format';
import { usePlus } from '@/lib/plus';

type RangeId = 'period' | 'weeks' | 'month' | 'months';

// the range picked and the one it's compared with, like for like
function ranges(id: RangeId, period: Period, input: BudgetData, now: Date): { range: DayRange; previous: DayRange } {
  const today = startOfDay(now);
  if (id === 'period') {
    const range = { start: period.start, end: today };
    const before = getPreviousPeriod(period, input.settings, input.incomes, input.termPlans);
    if (!before) return { range, previous: previousRange(range) };
    // day N of this period against day N of the last one
    const days = Math.min(inclusiveDays(period.start, today), inclusiveDays(before.start, before.end));
    return { range, previous: { start: before.start, end: addDays(before.start, days - 1) } };
  }
  if (id === 'month') {
    const range = { start: startOfMonth(today), end: today };
    const lastStart = addMonthsClamped(range.start, -1);
    return { range, previous: { start: lastStart, end: addMonthsClamped(today, -1) } };
  }
  const range = { start: id === 'weeks' ? addDays(today, -27) : addDays(addMonthsClamped(today, -3), 1), end: today };
  return { range, previous: previousRange(range) };
}

// "▲ 12% more", "▼ 30% less" or "new"
function changeLabel(changePercent: number | null, amount: number): string {
  if (changePercent === null) return amount > 0 ? t('insights.new') : '';
  if (changePercent === 0) return '';
  return changePercent > 0 ? t('insights.up', { pct: changePercent }) : t('insights.down', { pct: -changePercent });
}

// a category's sticker fill as a CSS variable, for the SVG charts
function fillVar(fill: string): string {
  return fill === 'bg-field' ? '--color-cat-stone' : `--color-${fill.slice(3)}`;
}

const monthShort = new Intl.DateTimeFormat(LOCALE, { month: 'short' });
const weekdayShort = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' });
const weekdayLong = new Intl.DateTimeFormat(LOCALE, { weekday: 'long' });
// Monday first: January 1, 2024 was a Monday
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i));

// the biggest categories as a ring; past six they're folded into one slice
function CategoryDonut({ rows, total }: { rows: readonly { key: string; amount: number; fill: string; name: string }[]; total: number }) {
  const shown = rows.filter((r) => r.amount > 0);
  const top = shown.slice(0, 6);
  const rest = shown.slice(6).reduce((s, r) => s + r.amount, 0);
  const slices: DonutSlice[] = [
    ...top.map((r) => ({ key: r.key, value: r.amount, color: fillVar(r.fill) })),
    ...(rest > 0 ? [{ key: 'rest', value: rest, color: '--color-cat-stone' }] : []),
  ];
  const list = shown.map((r) => `${r.name} ${Math.round((r.amount * 100) / Math.max(1, total))}%`).join(', ');
  return (
    <Donut
      slices={slices}
      a11y={t('chart.shareA11y', { list })}
      center={
        <View className="items-center">
          <Text className="font-display text-2xl tabular-nums text-ink">{money(total)}</Text>
          <Text className="font-sans text-xs text-muted">{t('summary.spent')}</Text>
        </View>
      }
    />
  );
}

// running total for the range against the same days of the one before it
function PaceChart({ input, range, previous }: { input: BudgetData; range: DayRange; previous: DayRange }) {
  const nowLine = cumulative(getDailySpending(input.transactions, input.categories, range.start, range.end));
  const beforeAll = cumulative(getDailySpending(input.transactions, input.categories, previous.start, previous.end));
  const now = nowLine.at(-1) ?? 0;
  const before = beforeAll[Math.min(nowLine.length, beforeAll.length) - 1] ?? 0;
  return (
    <ChartCard title={t('chart.pace')} line={t('chart.paceLine', { now: money(now), before: money(before) })}>
      <LineChart
        series={[
          { values: beforeAll, color: '--color-muted', dashed: true },
          { values: nowLine, color: '--color-cta', fill: true },
        ]}
        startLabel={monthDayLabel(range.start)}
        endLabel={monthDayLabel(range.end)}
        a11y={t('chart.paceA11y', { now: money(now), before: money(before) })}
      />
      <Legend
        items={[
          { label: t('chart.paceNow'), color: '--color-cta' },
          { label: t('chart.paceBefore'), color: '--color-muted', dashed: true },
        ]}
      />
    </ChartCard>
  );
}

// the last six calendar months, this one so far in ink
function MonthBars({ input, now }: { input: BudgetData; now: Date }) {
  const months = getMonthlyTotals(input.transactions, input.categories, now, 6);
  return (
    <ChartCard title={t('chart.months')} line={t('chart.monthsLine', { amount: money(months.at(-1)?.amount ?? 0) })}>
      <BarChart
        bars={months.map((m) => ({ key: String(m.start.getTime()), value: m.amount, label: monthShort.format(m.start) }))}
        highlight={months.length - 1}
        a11y={t('chart.monthsA11y', { list: months.map((m) => `${monthLabel(m.start)} ${money(m.amount)}`).join(', ') })}
      />
    </ChartCard>
  );
}

// which days of the week cost the most, on average, in the range
function WeekdayBars({ input, range }: { input: BudgetData; range: DayRange }) {
  const days = getWeekdayAverages(input.transactions, input.categories, range);
  const top = days.reduce((a, b) => (b.average > a.average ? b : a), days[0]!);
  return (
    <ChartCard title={t('chart.weekdays')} line={top.average > 0 ? t('chart.weekdaysLine', { day: weekdayLong.format(WEEKDAYS[top.weekday]!) }) : undefined}>
      <BarChart
        bars={days.map((d) => ({ key: String(d.weekday), value: d.average, label: weekdayShort.format(WEEKDAYS[d.weekday]!) }))}
        highlight={top.average > 0 ? top.weekday : undefined}
        a11y={t('chart.weekdaysA11y', { list: days.map((d) => `${weekdayLong.format(WEEKDAYS[d.weekday]!)} ${money(d.average)}`).join(', ') })}
      />
    </ChartCard>
  );
}

// the five places that took the most in the range
function TopPlaces({ input, range }: { input: BudgetData; range: DayRange }) {
  const places = getTopMerchants(input.transactions, input.categories, range, 5);
  return (
    <ChartCard title={t('chart.places')}>
      {places.length === 0 ? (
        <Text className="font-sans text-base text-muted">{t('chart.placesEmpty')}</Text>
      ) : (
        <RankBars
          rows={places.map((p) => ({
            key: p.name,
            label: p.name,
            detail: p.count === 1 ? t('chart.placesOnce') : t('chart.placesTimes', { count: p.count }),
            value: p.amount,
            valueLabel: money(p.amount),
          }))}
        />
      )}
    </ChartCard>
  );
}

// a month of days, each filled by how much was spent; tapping one lists that day's entries
function SpendCalendar({ input, now }: { input: BudgetData; now: Date }) {
  const ink = useCSSVariable('--color-ink') as string;
  const [month, setMonth] = useState(() => startOfMonth(now));
  const [picked, setPicked] = useState<Date | null>(null);
  const first = startOfMonth(month);
  const gridStart = addDays(first, -first.getDay());
  const days = getDailySpending(input.transactions, input.categories, gridStart, addDays(gridStart, 41));
  const inMonth = days.filter((d) => d.date.getMonth() === month.getMonth());
  const max = Math.max(1, ...inMonth.map((d) => d.amount));
  const weekdayInitials = t('common.weekdayInitials').split(',');

  // four steps of spend; light sticker fills read the same in both modes
  const fill = (amount: number) =>
    amount <= 0 ? 'bg-field' : amount < max / 3 ? 'bg-cat-butter' : amount < (2 * max) / 3 ? 'bg-cat-peach' : 'bg-cat-coral';

  const entries = picked
    ? input.transactions.filter((tx) => tx.amount > 0 && isSameDay(tx.date, picked) && !input.categories.some((c) => c.id === tx.categoryId && (c.kind === 'savings' || c.kind === 'income')))
    : [];

  return (
    <Raised>
      <View className="gap-3 p-5">
        <View className="flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.previousMonth')}
            onPress={() => setMonth(addMonthsClamped(month, -1))}
            className="h-11 w-11 items-center justify-center">
            <SymbolView name="chevron.left" size={16} weight="semibold" tintColor={ink} />
          </Pressable>
          <Text className="font-display-bold text-lg text-ink">{monthLabel(month)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.nextMonth')}
            disabled={daysBetween(addMonthsClamped(month, 1), now) < 0}
            onPress={() => setMonth(addMonthsClamped(month, 1))}
            className="h-11 w-11 items-center justify-center">
            <SymbolView name="chevron.right" size={16} weight="semibold" tintColor={ink} />
          </Pressable>
        </View>
        <View className="flex-row">
          {weekdayInitials.map((d, i) => (
            <Text key={i} className="flex-1 text-center font-sans-bold text-xs text-muted">
              {d}
            </Text>
          ))}
        </View>
        <View className="flex-row flex-wrap">
          {days.map((d) => {
            const shown = d.date.getMonth() === month.getMonth();
            const selected = !!picked && isSameDay(d.date, picked);
            return (
              <Pressable
                key={d.date.getTime()}
                disabled={!shown}
                onPress={() => setPicked(selected ? null : d.date)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={t('insights.dayA11y', { date: shortDate(d.date), amount: money(d.amount) })}
                className="h-11 w-[14.28%] items-center justify-center">
                {shown ? (
                  <View className={`h-9 w-9 items-center justify-center rounded-sm border-2 ${fill(d.amount)} ${selected ? 'border-ink' : 'border-transparent'}`}>
                    <Text className={`text-sm tabular-nums ${d.amount > 0 ? 'font-sans-bold text-on-brand' : 'font-sans text-ink'}`}>
                      {d.date.getDate()}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        {picked ? (
          <View className="gap-2 border-t-2 border-field pt-3">
            <Text className="font-sans-bold text-sm text-muted">{t('insights.spentOn', { date: shortDate(picked) })}</Text>
            {entries.length === 0 ? <Text className="font-sans text-base text-muted">{t('insights.nothingThatDay')}</Text> : null}
            {entries.map((e) => (
              <View key={e.id} className="flex-row justify-between gap-3">
                <Text className="flex-1 font-sans-medium text-base text-ink" numberOfLines={1}>
                  {e.merchantName ?? t('activity.spending')}
                </Text>
                <Text className="font-display-bold text-base tabular-nums text-ink">{money(e.amount)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Raised>
  );
}

// 2.8 (Plus): spending by category, week and day for any range, compared like for like
export default function InsightsScreen() {
  const isPlus = usePlus();
  const { input, result } = useSafeToSpend();
  const [rangeId, setRangeId] = useState<RangeId>('period');
  const now = new Date();

  if (!isPlus) {
    return (
      <Screen header={<BackButton />} title={t('insights.title')}>
        <PlusTeaser title={t('activity.insights')} body={t('plus.f.insights')} from="insights" />
      </Screen>
    );
  }
  if (!input || !result) return <Screen header={<BackButton />} title={t('insights.title')}>{null}</Screen>;

  const { range, previous } = ranges(rangeId, result.period, input, now);
  const rows = compareCategories(input.transactions, input.categories, range, previous).filter((r) => r.amount > 0 || r.previous > 0);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const previousTotal = rows.reduce((s, r) => s + r.previous, 0);
  const categories = new Map(input.categories.map((c) => [c.id, c]));
  const options: readonly { value: RangeId; label: string }[] = [
    { value: 'period', label: periodPhrase(result.period.kind, 'this') },
    { value: 'weeks', label: t('insights.last4Weeks') },
    { value: 'month', label: t('insights.thisMonth') },
    { value: 'months', label: t('insights.last3Months') },
  ];
  const totalPct = previousTotal > 0 ? Math.round(((total - previousTotal) * 100) / previousTotal) : null;

  return (
    <Screen header={<BackButton />} title={t('insights.title')}>
      <Chips options={options} value={rangeId} onChange={setRangeId} />
      <Raised>
        <View className="gap-3 p-5">
          <View className="gap-1">
            <Text className="font-sans-bold text-sm text-muted">
              {t('insights.range', { start: monthDayLabel(range.start), end: monthDayLabel(range.end) })}
            </Text>
            <Text className="font-display text-3xl tabular-nums text-ink">
              {money(total)} <Text className="font-display-bold text-lg">{t('summary.spent')}</Text>
            </Text>
            <Text className="font-sans text-sm text-muted">
              {t('insights.compared', { start: monthDayLabel(previous.start), end: monthDayLabel(previous.end) })}: {money(previousTotal)}
              {totalPct !== null && totalPct !== 0 ? ` · ${changeLabel(totalPct, total)}` : ''}
            </Text>
          </View>
          <Text className="font-display-bold text-lg text-ink">{t('insights.byCategory')}</Text>
          {rows.length === 0 ? (
            <Text className="font-sans text-base text-muted">{t('insights.nothing')}</Text>
          ) : (
            <CategoryDonut
              total={total}
              rows={rows.map((row) => {
                const category = row.categoryId ? categories.get(row.categoryId) : null;
                return {
                  key: row.categoryId ?? 'none',
                  amount: row.amount,
                  fill: category ? fillFor(category.color) : UNCATEGORIZED.fill,
                  name: category ? categoryName(category) : t('common.uncategorized'),
                };
              })}
            />
          )}
          {rows.map((row) => {
            const category = row.categoryId ? categories.get(row.categoryId) : null;
            const sticker = category ? { emoji: category.emoji, fill: fillFor(category.color) } : UNCATEGORIZED;
            const change = changeLabel(row.changePercent, row.amount);
            return (
              <View key={row.categoryId ?? 'none'} className="flex-row items-center gap-3">
                <Sticker emoji={sticker.emoji} fill={sticker.fill} size="sm" />
                <View className="flex-1">
                  <Text className="font-sans-medium text-base text-ink" numberOfLines={1}>
                    {category ? categoryName(category) : t('common.uncategorized')}
                  </Text>
                  {change ? <Text className="font-sans text-sm text-muted">{change}</Text> : null}
                </View>
                <Text className="font-display-bold text-base tabular-nums text-ink">{money(row.amount)}</Text>
              </View>
            );
          })}
        </View>
      </Raised>
      <PaceChart input={input} range={range} previous={previous} />
      <WeekdayBars input={input} range={range} />
      <TopPlaces input={input} range={range} />
      <WeekBars input={input} now={now} />
      <MonthBars input={input} now={now} />
      <Text className="font-display-bold text-xl text-ink">{t('insights.calendar')}</Text>
      <SpendCalendar input={input} now={now} />
    </Screen>
  );
}
