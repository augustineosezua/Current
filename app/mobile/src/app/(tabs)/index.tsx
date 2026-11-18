import { getCheckInStaleness, type StsResult } from '@current/core';
import { Link, Redirect, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { BudgetBanners } from '@/components/budget-banners';
import { Button } from '@/components/form';
import { PlusRow, useRequirePlus } from '@/components/plus';
import { EmptyState, Screen } from '@/components/screen';
import { StsHero } from '@/components/sts-hero';
import { Last30Days } from '@/components/last-30-days';
import { saveSetting } from '@/db/plan';
import { useSafeToSpend } from '@/db/sts';
import { LOCALE, t } from '@/i18n';
import { isBackupDue } from '@/lib/backup';
import { exportTransactions } from '@/lib/export';
import { money, monthDayLabel, untilLabel } from '@/lib/format';

const today = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
});

// round icon button in the header
function HeaderButton({ icon, label, onPress }: { icon: 'gearshape' | 'bubble.left.and.text.bubble.right'; label: string; onPress: () => void }) {
  const ink = useCSSVariable('--color-ink') as string;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} className="h-11 w-11 items-center justify-center rounded-full bg-field active:opacity-70">
      <SymbolView name={icon} size={20} tintColor={ink} />
    </Pressable>
  );
}

// date on the left, Ask Current and settings on the right
function HomeHeader() {
  const requirePlus = useRequirePlus();
  const label = today.format(new Date());
  return (
    <View className="flex-row items-center justify-between">
      <Text className="font-sans-medium text-base text-muted">{label[0]!.toUpperCase() + label.slice(1)}</Text>
      <View className="flex-row gap-2">
        <HeaderButton icon="bubble.left.and.text.bubble.right" label={t('home.ask')} onPress={() => requirePlus('ask') && router.push('/ask')} />
        <HeaderButton icon="gearshape" label={t('home.settings')} onPress={() => router.push('/settings')} />
      </View>
    </View>
  );
}

// stale balance warning: flat and plain on purpose (DESIGN.md "Limits"), never decorated
function StaleBalanceRow({ days, accountId }: { days: number; accountId: string }) {
  return (
    <View className="gap-3 rounded-md bg-card p-4">
      <Text className="font-sans-medium text-base text-ink">{t('home.staleBalance', { days })}</Text>
      <Button label={t('home.checkIt')} kind="secondary" onPress={() => router.push({ pathname: '/check-in', params: { id: accountId } })} />
    </View>
  );
}

// one line of the breakdown: what it is on the left, the signed amount on the right
function BreakdownRow({ label, amount, strong = false }: { label: string; amount: string; strong?: boolean }) {
  return (
    <View className="flex-row items-baseline justify-between gap-3">
      <Text className={`shrink text-base ${strong ? 'font-sans-bold text-ink' : 'font-sans text-muted'}`}>{label}</Text>
      <Text className={`text-base tabular-nums text-ink ${strong ? 'font-display-bold' : 'font-sans-medium'}`}>{amount}</Text>
    </View>
  );
}

// "how it's calculated": the sum behind the daily number, closed until tapped
function Breakdown({ result }: { result: StsResult }) {
  const [open, setOpen] = useState(false);
  const ink = useCSSVariable('--color-ink') as string;
  const b = result.breakdown;
  const minus = (cents: number) => `−${money(cents)}`;
  // term money that frees up between now and the end of the period
  const releasing = result.daily.total - result.safeToSpend;
  const days = result.daily.daysLeft;
  const date = untilLabel(result.daily.periodEnd);

  return (
    <View className="rounded-md bg-card">
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="min-h-13 flex-row items-center justify-between p-4 active:opacity-70">
        <Text className="font-sans-medium text-base text-muted">{t('home.howWeGotThis')}</Text>
        <SymbolView name={open ? 'chevron.up' : 'chevron.down'} size={14} weight="semibold" tintColor={ink} />
      </Pressable>
      {open ? (
        <View className="gap-2 px-4 pb-4">
          <BreakdownRow label={t('home.inAccounts')} amount={money(b.spendableBalance)} />
          {b.billsTotal > 0 ? (
            <BreakdownRow label={t('home.billsDueBy', { date: monthDayLabel(result.billsCutoff) })} amount={minus(b.billsTotal)} />
          ) : null}
          {b.termReserve > 0 ? <BreakdownRow label={t('home.termForLater')} amount={minus(b.termReserve)} /> : null}
          {b.committedGoals > 0 ? <BreakdownRow label={t('home.savingForGoals')} amount={minus(b.committedGoals)} /> : null}
          <BreakdownRow label={t('home.safeToSpend')} amount={money(result.safeToSpend)} strong />
          {releasing > 0 ? (
            <BreakdownRow label={t('home.termUnlocking', { date: monthDayLabel(result.daily.periodEnd) })} amount={`+${money(releasing)}`} />
          ) : null}
          <BreakdownRow
            label={days === 1 ? t('home.overOneDay', { date }) : t('home.overDays', { count: days, date })}
            amount={t('home.perDay', { amount: money(result.daily.perDay) })}
            strong
          />
          <Text className="font-sans text-sm leading-5 text-muted">{t('home.breakdownNote')}</Text>
        </View>
      ) : null}
    </View>
  );
}

// monthly nudge to keep a copy: flat and plain, like the stale-balance row
function BackupRow() {
  const db = useSQLiteContext();
  const done = () => void saveSetting(db, 'backupNudgedAt', new Date().toISOString());
  return (
    <View className="gap-3 rounded-md bg-card p-4">
      <Text className="font-sans-medium text-base text-ink">{t('home.backupTitle')}</Text>
      <Text className="font-sans text-base leading-6 text-muted">{t('home.backupBody')}</Text>
      <Button
        label={t('home.export')}
        kind="secondary"
        onPress={() =>
          void exportTransactions(db)
            .then(done)
            .catch(() => {})
        }
      />
      <Button label={t('common.later')} kind="plain" onPress={done} />
    </View>
  );
}

// the one free chart, right under the number: spending each day for the last 30 days, with the way into the rest (Plus)
function HomeChart({ input }: { input: NonNullable<ReturnType<typeof useSafeToSpend>['input']> }) {
  if (input.transactions.length === 0) return null;
  return (
    <Last30Days
      input={input}
      now={new Date()}
      footer={<Button label={t('activity.insights')} kind="secondary" onPress={() => router.push('/insights')} />}
    />
  );
}

// home: the daily Safe-to-Spend number is the headline
export default function HomeScreen() {
  const { result, input, error } = useSafeToSpend();

  // load failure: say so plainly, never show a number we can't stand behind
  if (error) {
    return (
      <Screen header={<HomeHeader />}>
        <EmptyState title={t('home.loadError')} body={error.message} />
      </Screen>
    );
  }

  if (!result || !input) return <Screen header={<HomeHeader />}>{null}</Screen>;

  // first run: set up before showing a number
  if (!input.settings.onboarded && input.accounts.length === 0) return <Redirect href="/onboarding" />;

  const stale = getCheckInStaleness(input.accounts, new Date());

  return (
    <Screen header={<HomeHeader />}>
      <StsHero result={result} show={input.settings.heroAmount} />
      <HomeChart input={input} />
      {stale ? <StaleBalanceRow days={stale.days} accountId={stale.accountId} /> : null}
      <BudgetBanners input={input} result={result} />
      <Link href="/accounts" asChild>
        <Pressable accessibilityRole="button" className="flex-row items-center justify-between rounded-md bg-card p-4 active:opacity-70">
          <Text className="font-sans-medium text-base text-muted">{t('home.inAccounts')}</Text>
          <Text className="font-display-bold text-lg tabular-nums text-ink">{money(result.breakdown.spendableBalance)}</Text>
        </Pressable>
      </Link>
      <Breakdown result={result} />
      {/* 2.2 entry: a flat row under the number, so nothing competes with it */}
      <PlusRow label={t('home.afford')} from="afford" onOpen={() => router.push('/afford')} />
      {isBackupDue(input.settings.backupNudgedAt, input.transactions, new Date()) ? <BackupRow /> : null}
    </Screen>
  );
}
