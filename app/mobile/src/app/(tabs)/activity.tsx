import { formatMoney } from '@current/core';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { PeriodSummary } from '@/components/period-summary';
import { Raised } from '@/components/raised';
import { EmptyState, Screen } from '@/components/screen';
import { Sticker } from '@/components/sticker';
import { CHECK_IN_MERCHANT } from '@/db/ledger';
import { toDateString, type CategoryRecord, type TransactionRecord } from '@/db/records';
import { useSafeToSpend } from '@/db/sts';
import { fillFor, UNCATEGORIZED } from '@/lib/categories';
import { dayLabel } from '@/lib/format';

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

// the category's sticker, or one for the kind of entry when it has no category
function stickerFor(t: TransactionRecord, category: CategoryRecord | null): { emoji: string; fill: string } {
  if (category) return { emoji: category.emoji, fill: fillFor(category.color) };
  if (t.merchantName === CHECK_IN_MERCHANT) return { emoji: '⚖️', fill: 'bg-cat-stone' };
  if (t.createdFromBill) return { emoji: '🧾', fill: 'bg-cat-sand' };
  return UNCATEGORIZED;
}

// one transaction; tapping opens it for editing
function TransactionRow({
  transaction: t,
  category,
  accountName,
}: {
  transaction: TransactionRecord;
  category: CategoryRecord | null;
  accountName: string | null;
}) {
  const sticker = stickerFor(t, category);
  const title = t.merchantName ?? category?.name ?? (t.amount < 0 ? 'Money in' : 'Spending');
  // category under the name, unless the name already is the category
  const details = [t.merchantName ? category?.name : null, accountName].filter(Boolean).join(' · ');
  const amount = t.amount < 0 ? `+${formatMoney(-t.amount)}` : formatMoney(t.amount);
  return (
    <Link href={{ pathname: '/add', params: { id: t.id } }} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${amount}${details ? `, ${details}` : ''}. Edit`}
        className="min-h-16 flex-row items-center gap-3 px-4 py-2 active:opacity-70">
        <Sticker emoji={sticker.emoji} fill={sticker.fill} />
        <View className="flex-1">
          <Text className="font-sans-bold text-base text-ink" numberOfLines={1}>
            {title}
          </Text>
          {details ? <Text className="font-sans text-sm text-muted">{details}</Text> : null}
        </View>
        <Text className="font-display-bold text-lg tabular-nums text-ink">{amount}</Text>
      </Pressable>
    </Link>
  );
}

// this period's spending summary, then everything logged, newest first, grouped by day
export default function ActivityScreen() {
  const { input, result, error } = useSafeToSpend();

  if (error) {
    return (
      <Screen title="Activity">
        <EmptyState title="Couldn't load your activity" body={error.message} />
      </Screen>
    );
  }
  if (!input || !result) return <Screen title="Activity">{null}</Screen>;

  // account names only matter once there is more than one account
  const data = {
    transactions: input.transactions,
    accountNames: new Map(input.accounts.map((a) => [a.id, a.name])),
    categories: new Map(input.categories.map((c) => [c.id, c])),
  };
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
        <PeriodSummary input={input} result={result} />
      )}
      {data.transactions.length === 0 ? null : (
        groupByDay(data.transactions).map((group) => (
          <View key={group.key} className="gap-2">
            <Text className="font-sans-bold text-sm text-muted">{dayLabel(group.date)}</Text>
            <Raised>
              <View className="py-1">
                {group.items.map((t) => (
                  <TransactionRow
                    key={t.id}
                    transaction={t}
                    category={(t.categoryId && data.categories.get(t.categoryId)) || null}
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
