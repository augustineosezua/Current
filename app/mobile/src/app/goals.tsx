import { EmptyState, Screen } from '@/components/screen';

// savings goals (built in 1.9)
export default function GoalsScreen() {
  return (
    <Screen title="Goals">
      <EmptyState title="No savings goals" body="Pick something to save for and we'll set money aside each paycheque." />
    </Screen>
  );
}
