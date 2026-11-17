import { EmptyState, Screen } from '@/components/screen';

// transaction list (built in 1.1)
export default function TransactionsScreen() {
  return (
    <Screen title="Activity">
      <EmptyState title="No transactions yet" body="Log your first purchase to see it here." />
    </Screen>
  );
}
