import { Text } from 'react-native';

import { EmptyState, Screen } from '@/components/screen';

// what's already spoken for: bills (1.9), goals (1.9) and term money (1.6)
export default function PlanScreen() {
  return (
    <Screen title="Plan">
      <Text className="font-display-bold text-xl text-ink">Bills</Text>
      <EmptyState
        stickers={[
          { emoji: '🏠', fill: 'bg-cat-sand', tilt: -1 },
          { emoji: '📱', fill: 'bg-cat-sky', tilt: 1 },
        ]}
        title="No bills yet"
        body="Add rent, your phone and subscriptions so they're set aside before your daily number."
      />
      <Text className="font-display-bold text-xl text-ink">Goals</Text>
      <EmptyState
        stickers={[
          { emoji: '✈️', fill: 'bg-cat-sky', tilt: -2 },
          { emoji: '🎯', fill: 'bg-cat-butter', tilt: 1 },
          { emoji: '💻', fill: 'bg-cat-lilac', tilt: 2 },
        ]}
        title="Nothing saved for yet"
        body="A trip, a laptop, or just a cushion? Add it and we'll set a little aside every paycheque."
      />
    </Screen>
  );
}
