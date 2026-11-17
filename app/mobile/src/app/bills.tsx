import { EmptyState, Screen } from '@/components/screen';

// bills list (built in 1.9)
export default function BillsScreen() {
  return (
    <Screen title="Bills">
      <EmptyState title="No upcoming bills" body="Add rent, phone and subscriptions so they never surprise you." />
    </Screen>
  );
}
