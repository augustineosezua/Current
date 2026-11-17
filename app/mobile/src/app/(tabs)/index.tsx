import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

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

// home: the daily Safe-to-Spend number is the headline
export default function HomeScreen() {
  const { result, error } = useSafeToSpend();

  // load failure: say so plainly, never show a number we can't stand behind
  if (error) {
    return (
      <Screen header={<HomeHeader />}>
        <EmptyState title="Couldn't load your budget" body={error.message} />
      </Screen>
    );
  }

  if (!result) return <Screen header={<HomeHeader />}>{null}</Screen>;

  const isEmpty = result.breakdown.spendableBalance === 0;

  return (
    <Screen header={<HomeHeader />}>
      <StsHero result={result} />
      {isEmpty ? (
        <EmptyState
          stickers={[
            { emoji: '👛', fill: 'bg-cat-butter', tilt: -1 },
            { emoji: '💸', fill: 'bg-cat-mint', tilt: 1 },
          ]}
          title="Start with your balance"
          body="Tell us what's in your account and when you're paid next. Takes under a minute."
        />
      ) : null}
    </Screen>
  );
}
