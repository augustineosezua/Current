import { Link, router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { BudgetBanners } from '@/components/budget-banners';
import { PlusRow } from '@/components/plus';
import { PeriodSummary } from '@/components/period-summary';
import { Row } from '@/components/motion';
import { Raised } from '@/components/raised';
import { EmptyState, Screen } from '@/components/screen';
import { Sticker } from '@/components/sticker';
import { isCheckInEntry } from '@/db/ledger';
import { toDateString, type CategoryRecord, type TransactionRecord } from '@/db/records';
import { useSafeToSpend } from '@/db/sts';
import { t } from '@/i18n';
import { categoryName, fillFor, UNCATEGORIZED } from '@/lib/categories';
import { dayLabel, money } from '@/lib/format';

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
function stickerFor(tx: TransactionRecord, category: CategoryRecord | null): { emoji: string; fill: string } {
  if (category) return { emoji: category.emoji, fill: fillFor(category.color) };
  if (isCheckInEntry(tx.merchantName)) return { emoji: '⚖️', fill: 'bg-cat-stone' };
  if (tx.createdFromBill) return { emoji: '🧾', fill: 'bg-cat-sand' };
  return UNCATEGORIZED;
}

// one transaction; tapping opens it for editing
function TransactionRow({
  transaction: tx,
  category,
  accountName,
}: {
  transaction: TransactionRecord;
  category: CategoryRecord | null;
  accountName: string | null;
}) {
  const sticker = stickerFor(tx, category);
  const name = category ? categoryName(category) : null;
  const title = tx.merchantName ?? name ?? (tx.amount < 0 ? t('activity.moneyIn') : t('activity.spending'));
  // category under the name, unless the name already is the category
  const details = [tx.merchantName ? name : null, accountName].filter(Boolean).join(' · ');
  const amount = tx.amount < 0 ? `+${money(-tx.amount)}` : money(tx.amount);
  return (
    <Link href={{ pathname: '/add', params: { id: tx.id } }} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.edit', { label: `${title}, ${amount}${details ? `, ${details}` : ''}` })}
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
      <Screen title={t('activity.title')}>
        <EmptyState title={t('activity.loadError')} body={error.message} />
      </Screen>
    );
  }
  if (!input || !result) return <Screen title={t('activity.title')}>{null}</Screen>;

  // account names only matter once there is more than one account
  const data = {
    transactions: input.transactions,
    accountNames: new Map(input.accounts.map((a) => [a.id, a.name])),
    categories: new Map(input.categories.map((c) => [c.id, c])),
  };
  const showAccounts = data.accountNames.size > 1;

  return (
    <Screen title={t('activity.title')}>
      {data.transactions.length === 0 ? (
        <EmptyState
          stickers={[
            { emoji: '☕', fill: 'bg-cat-peach', tilt: -2 },
            { emoji: '🚌', fill: 'bg-cat-sky', tilt: 1 },
            { emoji: '🛒', fill: 'bg-cat-mint', tilt: -1 },
          ]}
          title={t('activity.emptyTitle')}
          body={t('activity.emptyBody')}
        />
      ) : (
        <>
          <BudgetBanners input={input} result={result} />
          <PeriodSummary input={input} result={result} />
          <PlusRow label={t('activity.insights')} from="insights" onOpen={() => router.push('/insights')} />
          <PlusRow label={t('recap.title')} from="recap" onOpen={() => router.push('/recap')} />
        </>
      )}
      {data.transactions.length === 0
        ? null
        : groupByDay(data.transactions).map((group) => (
            <View key={group.key} className="gap-2">
              <Text className="font-sans-bold text-sm text-muted">{dayLabel(group.date)}</Text>
              <Raised>
                <View className="py-1">
                  {group.items.map((tx) => (
                    <Row key={tx.id}>
                      <TransactionRow
                        transaction={tx}
                        category={(tx.categoryId && data.categories.get(tx.categoryId)) || null}
                        accountName={showAccounts && tx.accountId ? (data.accountNames.get(tx.accountId) ?? null) : null}
                      />
                    </Row>
                  ))}
                </View>
              </Raised>
            </View>
          ))}
    </Screen>
  );
}
