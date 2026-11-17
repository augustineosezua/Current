import { formatMoney } from '@current/core';
import { Text, View } from 'react-native';

import { EmptyState, Screen } from '@/components/screen';
import { useSafeToSpend } from '@/db/sts';

const weekday = new Intl.DateTimeFormat('en-CA', { weekday: 'long' });

// home: the daily Safe-to-Spend number is the headline, the total sits underneath
export default function HomeScreen() {
  const { result, error } = useSafeToSpend();

  // load failure: say so plainly instead of showing a wrong number
  if (error) {
    return (
      <Screen>
        <EmptyState title="Couldn't load your budget" body={error.message} />
      </Screen>
    );
  }

  if (!result) return <Screen>{null}</Screen>;

  const { perDay, periodEnd } = result.daily;
  const isEmpty = result.breakdown.spendableBalance === 0;

  return (
    <Screen>
      <View className="gap-2 pt-12">
        <Text className="font-sans-medium text-base text-white/70">Safe to spend</Text>
        <Text className="font-sans-extrabold text-sts text-accent">
          {formatMoney(perDay)}
          <Text className="font-sans-bold text-2xl text-white/70">/day</Text>
        </Text>
        <Text className="font-sans text-base text-white/70">
          until {weekday.format(periodEnd)} · {formatMoney(result.safeToSpend)} total
        </Text>
      </View>
      {isEmpty ? (
        <EmptyState title="Start with your balance" body="Add what's in your account and your next paycheque." />
      ) : null}
    </Screen>
  );
}
