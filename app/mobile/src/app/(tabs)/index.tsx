import { formatMoney, getCheckInStaleness, type StsResult } from '@current/core';
import { Link, Redirect, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Button } from '@/components/form';
import { EmptyState, Screen } from '@/components/screen';
import { StsHero } from '@/components/sts-hero';
import { saveSetting } from '@/db/plan';
import { useSafeToSpend } from '@/db/sts';
import { isBackupDue } from '@/lib/backup';
import { exportTransactions } from '@/lib/export';
import { monthDayLabel, untilLabel } from '@/lib/format';

const today = new Intl.DateTimeFormat('en-CA', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
});

// date on the left, settings on the right
function HomeHeader() {
  const ink = useCSSVariable('--color-ink') as string;
  return (
    <View className="flex-row items-center justify-between">
      <Text className="font-sans-medium text-base text-muted">{today.format(new Date())}</Text>
      <Link href="/settings" asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          className="h-11 w-11 items-center justify-center rounded-full bg-field">
          <SymbolView name="gearshape" size={20} tintColor={ink} />
        </Pressable>
      </Link>
    </View>
  );
}

// stale balance warning: flat and plain on purpose (DESIGN.md "Limits"), never decorated
function StaleBalanceRow({ days, accountId }: { days: number; accountId: string }) {
  return (
    <View className="gap-3 rounded-md bg-card p-4">
      <Text className="font-sans-medium text-base text-ink">You haven&apos;t checked your balance in {days} days</Text>
      <Button label="Check it" kind="secondary" onPress={() => router.push({ pathname: '/check-in', params: { id: accountId } })} />
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
  const minus = (cents: number) => `−${formatMoney(cents)}`;
  // term money that frees up between now and the end of the period
  const releasing = result.daily.total - result.safeToSpend;
  const days = result.daily.daysLeft;

  return (
    <View className="rounded-md bg-card">
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="min-h-13 flex-row items-center justify-between p-4 active:opacity-70">
        <Text className="font-sans-medium text-base text-muted">How we got this number</Text>
        <SymbolView name={open ? 'chevron.up' : 'chevron.down'} size={14} weight="semibold" tintColor={ink} />
      </Pressable>
      {open ? (
        <View className="gap-2 px-4 pb-4">
          <BreakdownRow label="In your accounts" amount={formatMoney(b.spendableBalance)} />
          {b.billsTotal > 0 ? (
            <BreakdownRow label={`Bills due by ${monthDayLabel(result.billsCutoff)}`} amount={minus(b.billsTotal)} />
          ) : null}
          {b.termReserve > 0 ? <BreakdownRow label="Semester money for later" amount={minus(b.termReserve)} /> : null}
          {b.committedGoals > 0 ? <BreakdownRow label="Saving for goals" amount={minus(b.committedGoals)} /> : null}
          <BreakdownRow label="Safe to spend" amount={formatMoney(result.safeToSpend)} strong />
          {releasing > 0 ? (
            <BreakdownRow
              label={`Semester money unlocking by ${monthDayLabel(result.daily.periodEnd)}`}
              amount={`+${formatMoney(releasing)}`}
            />
          ) : null}
          <BreakdownRow
            label={`Over ${days} ${days === 1 ? 'day' : 'days'}, until ${untilLabel(result.daily.periodEnd)}`}
            amount={`${formatMoney(result.daily.perDay)}/day`}
            strong
          />
          <Text className="font-sans text-sm leading-5 text-muted">
            Your savings aren&apos;t counted here. Bills you&apos;ve paid are already gone from your balance.
          </Text>
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
      <Text className="font-sans-medium text-base text-ink">Want to save a copy?</Text>
      <Text className="font-sans text-base leading-6 text-muted">
        Your budget lives on this phone and gets backed up with it to iCloud. Exporting a CSV takes a sec too.
      </Text>
      <Button
        label="Export"
        kind="secondary"
        onPress={() =>
          void exportTransactions(db)
            .then(done)
            .catch(() => {})
        }
      />
      <Button label="Later" kind="plain" onPress={done} />
    </View>
  );
}

// home: the daily Safe-to-Spend number is the headline
export default function HomeScreen() {
  const { result, input, error } = useSafeToSpend();

  // load failure: say so plainly, never show a number we can't stand behind
  if (error) {
    return (
      <Screen header={<HomeHeader />}>
        <EmptyState title="Couldn't load your budget" body={error.message} />
      </Screen>
    );
  }

  if (!result || !input) return <Screen header={<HomeHeader />}>{null}</Screen>;

  // first run: set up before showing a number
  if (!input.settings.onboarded && input.accounts.length === 0) return <Redirect href="/onboarding" />;

  const stale = getCheckInStaleness(input.accounts, new Date());

  return (
    <Screen header={<HomeHeader />}>
      <StsHero result={result} />
      {stale ? <StaleBalanceRow days={stale.days} accountId={stale.accountId} /> : null}
      <Link href="/accounts" asChild>
        <Pressable accessibilityRole="button" className="flex-row items-center justify-between rounded-md bg-card p-4 active:opacity-70">
          <Text className="font-sans-medium text-base text-muted">In your accounts</Text>
          <Text className="font-display-bold text-lg tabular-nums text-ink">{formatMoney(result.breakdown.spendableBalance)}</Text>
        </Pressable>
      </Link>
      <Breakdown result={result} />
      {isBackupDue(input.settings.backupNudgedAt, input.transactions, new Date()) ? <BackupRow /> : null}
    </Screen>
  );
}
