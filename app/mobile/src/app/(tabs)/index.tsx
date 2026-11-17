import { formatMoney, getCheckInStaleness } from '@current/core';
import { Link, Redirect, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Button } from '@/components/form';
import { EmptyState, Screen } from '@/components/screen';
import { StsHero } from '@/components/sts-hero';
import { useSafeToSpend } from '@/db/sts';

const today = new Intl.DateTimeFormat('en-CA', { weekday: 'long', month: 'short', day: 'numeric' });

// date on the left, settings on the right
function HomeHeader() {
  const ink = useCSSVariable('--color-ink') as string;
  return (
    <View className="flex-row items-center justify-between">
      <Text className="font-sans-medium text-base text-muted">{today.format(new Date())}</Text>
      <Link href="/settings" asChild>
        <Pressable accessibilityRole="button" accessibilityLabel="Settings" className="h-11 w-11 items-center justify-center rounded-full bg-field">
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
      <Text className="font-sans-medium text-base text-ink">Balance last checked {days} days ago</Text>
      <Button label="Check now" kind="secondary" onPress={() => router.push({ pathname: '/check-in', params: { id: accountId } })} />
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
    </Screen>
  );
}
