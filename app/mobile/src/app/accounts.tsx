import { Link, router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { Button } from '@/components/form';
import { Raised } from '@/components/raised';
import { Screen } from '@/components/screen';
import type { AccountRecord } from '@/db/records';
import * as repo from '@/db/repo';
import { useLiveQuery } from '@/hooks/use-live-query';
import { t } from '@/i18n';
import { daysAgoLabel, money } from '@/lib/format';

// one account: tap anywhere on it to change its name, type or balance
function AccountCard({ account }: { account: AccountRecord }) {
  return (
    <Link href={{ pathname: '/account', params: { id: account.id } }} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.edit', { label: `${account.name}, ${money(account.balance)}` })}>
        {({ pressed }) => (
          <Raised pressed={pressed}>
            <View className="gap-1 p-5">
              <View className="flex-row items-baseline justify-between gap-3">
                <Text className="shrink font-display-bold text-lg text-ink">{account.name}</Text>
                <Text className="font-display text-2xl tabular-nums text-ink">{money(account.balance)}</Text>
              </View>
              <Text className="font-sans text-base text-muted">
                {t(`accountType.${account.type}`)}
                {account.lastCheckInAt ? t('accounts.checked', { when: daysAgoLabel(account.lastCheckInAt) }) : ''}
              </Text>
            </View>
          </Raised>
        )}
      </Pressable>
    </Link>
  );
}

// every account with its balance and when it was last checked
export default function AccountsScreen() {
  const { data } = useLiveQuery(repo.accounts.list);

  return (
    <Screen header={<BackButton />} title={t('accounts.title')}>
      {(data ?? []).map((a) => (
        <AccountCard key={a.id} account={a} />
      ))}
      <Button label={t('accounts.add')} onPress={() => router.push('/account')} />
    </Screen>
  );
}
