import { formatMoney } from '@current/core';
import { Link } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Pressable, Text, View } from 'react-native';

import { Raised } from '@/components/raised';
import { EmptyState, Screen } from '@/components/screen';
import { Sticker } from '@/components/sticker';
import { CHECK_IN_MERCHANT } from '@/db/ledger';
import { toDateString, type TransactionRecord } from '@/db/records';
import * as repo from '@/db/repo';
import { useLiveQuery } from '@/hooks/use-live-query';
import { dayLabel } from '@/lib/format';

interface ActivityData {
  transactions: TransactionRecord[];
  accountNames: Map<string, string>;
}

// every transaction, newest first, with account names for when there is more than one account
async function loadActivity(db: SQLiteDatabase): Promise<ActivityData> {
  const [transactions, accounts] = await Promise.all([repo.transactions.list(db), repo.accounts.list(db)]);
  return { transactions, accountNames: new Map(accounts.map((a) => [a.id, a.name])) };
}

// consecutive transactions that share a day
function groupByDay(transactions: readonly TransactionRecord[]): { key: string; date: Date; items: TransactionRecord[] }[] {
  const groups: { key: string; date: Date; items: TransactionRecord[] }[] = [];
  for (const t of transactions) {
    const key = toDateString(t.date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(t);
    else groups.push({ key, date: t.date, items: [t] });
  }
  return groups;
}

// sticker by what kind of entry this is (category stickers arrive with 1.2)
function stickerFor(t: TransactionRecord): { emoji: string; fill: string } {
  if (t.merchantName === CHECK_IN_MERCHANT) return { emoji: '⚖️', fill: 'bg-cat-stone' };
  if (t.createdFromBill) return { emoji: '🧾', fill: 'bg-cat-sand' };
  if (t.amount < 0) return { emoji: '💸', fill: 'bg-cat-mint' };
  return { emoji: '🛍️', fill: 'bg-cat-peach' };
}

// one transaction; tapping opens it for editing
function TransactionRow({ transaction: t, accountName }: { transaction: TransactionRecord; accountName: string | null }) {
  const sticker = stickerFor(t);
  const title = t.merchantName ?? (t.amount < 0 ? 'Money in' : 'Spending');
  const amount = t.amount < 0 ? `+${formatMoney(-t.amount)}` : formatMoney(t.amount);
  return (
    <Link href={{ pathname: '/add', params: { id: t.id } }} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${amount}${accountName ? `, ${accountName}` : ''}. Edit`}
        className="min-h-16 flex-row items-center gap-3 px-4 py-2 active:opacity-70">
        <Sticker emoji={sticker.emoji} fill={sticker.fill} />
        <View className="flex-1">
          <Text className="font-sans-bold text-base text-ink" numberOfLines={1}>
            {title}
          </Text>
          {accountName ? <Text className="font-sans text-sm text-muted">{accountName}</Text> : null}
        </View>
        <Text className="font-display-bold text-lg tabular-nums text-ink">{amount}</Text>
      </Pressable>
    </Link>
  );
}

// everything logged, newest first, grouped by day
export default function ActivityScreen() {
  const { data, error } = useLiveQuery(loadActivity);

  if (error) {
    return (
      <Screen title="Activity">
        <EmptyState title="Couldn't load your activity" body={error.message} />
      </Screen>
    );
  }
  if (!data) return <Screen title="Activity">{null}</Screen>;

  const showAccounts = data.accountNames.size > 1;

  return (
    <Screen title="Activity">
      {data.transactions.length === 0 ? (
        <EmptyState
          stickers={[
            { emoji: '☕', fill: 'bg-cat-peach', tilt: -2 },
            { emoji: '🚌', fill: 'bg-cat-sky', tilt: 1 },
            { emoji: '🛒', fill: 'bg-cat-mint', tilt: -1 },
          ]}
          title="Nothing logged yet"
          body="Tap + to log your first purchase. It takes about three seconds."
        />
      ) : (
        groupByDay(data.transactions).map((group) => (
          <View key={group.key} className="gap-2">
            <Text className="font-sans-bold text-sm text-muted">{dayLabel(group.date)}</Text>
            <Raised>
              <View className="py-1">
                {group.items.map((t) => (
                  <TransactionRow
                    key={t.id}
                    transaction={t}
                    accountName={showAccounts && t.accountId ? (data.accountNames.get(t.accountId) ?? null) : null}
                  />
                ))}
              </View>
            </Raised>
          </View>
        ))
      )}
    </Screen>
  );
}
