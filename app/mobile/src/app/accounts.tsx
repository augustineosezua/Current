import { formatMoney } from '@current/core';
import { Link, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Button } from '@/components/form';
import { Raised } from '@/components/raised';
import { Screen } from '@/components/screen';
import type { AccountRecord } from '@/db/records';
import * as repo from '@/db/repo';
import { useLiveQuery } from '@/hooks/use-live-query';
import { daysAgoLabel } from '@/lib/format';

const TYPE_LABELS = { chequing: 'Chequing', savings: 'Savings', cash: 'Cash' } as const;

// back to settings
function BackButton() {
  const ink = useCSSVariable('--color-ink') as string;
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Back"
      className="h-11 w-11 items-center justify-center rounded-full bg-field">
      <SymbolView name="chevron.left" size={18} weight="semibold" tintColor={ink} />
    </Pressable>
  );
}

// one account: tap the top to edit it, the button to check its balance
function AccountCard({ account }: { account: AccountRecord }) {
  return (
    <Raised>
      <View className="gap-4 p-5">
        <Link href={{ pathname: '/account', params: { id: account.id } }} asChild>
          <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${account.name}`} className="gap-1">
            <View className="flex-row items-baseline justify-between gap-3">
              <Text className="shrink font-display-bold text-xl text-ink">{account.name}</Text>
              <Text className="font-display text-2xl tabular-nums text-ink">{formatMoney(account.balance)}</Text>
            </View>
            <Text className="font-sans text-base text-muted">
              {TYPE_LABELS[account.type]}
              {account.lastCheckInAt ? ` · checked ${daysAgoLabel(account.lastCheckInAt)}` : ''}
            </Text>
          </Pressable>
        </Link>
        <Button
          label="Check balance"
          kind="secondary"
          onPress={() => router.push({ pathname: '/check-in', params: { id: account.id } })}
        />
      </View>
    </Raised>
  );
}

// every account with its balance and when it was last checked
export default function AccountsScreen() {
  const { data } = useLiveQuery(repo.accounts.list);

  return (
    <Screen header={<BackButton />} title="Accounts">
      {(data ?? []).map((a) => (
        <AccountCard key={a.id} account={a} />
      ))}
      <Button label="Add an account" onPress={() => router.push('/account')} />
    </Screen>
  );
}
