import { EmptyState, Screen } from '@/components/screen';

// everything logged, newest first (list built in 1.1)
export default function ActivityScreen() {
  return (
    <Screen title="Activity">
      <EmptyState
        stickers={[
          { emoji: '☕', fill: 'bg-cat-peach', tilt: -2 },
          { emoji: '🚌', fill: 'bg-cat-sky', tilt: 1 },
          { emoji: '🛒', fill: 'bg-cat-mint', tilt: -1 },
        ]}
        title="Nothing logged yet"
        body="Tap + to log your first purchase. It takes about three seconds."
      />
    </Screen>
  );
}
