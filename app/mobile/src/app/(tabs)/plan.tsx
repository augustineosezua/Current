import { addDays, daysBetween, formatMoney, getBillStatus, sortBillsForDisplay } from '@current/core';
import * as Haptics from 'expo-haptics';
import { Link, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Button } from '@/components/form';
import { Raised } from '@/components/raised';
import { EmptyState, Screen } from '@/components/screen';
import { useToast } from '@/components/toast';
import { markBillPaid, markBillUnpaid } from '@/db/ledger';
import type { BillRecord } from '@/db/records';
import * as repo from '@/db/repo';
import { useLiveQuery } from '@/hooks/use-live-query';
import { dayLabel, FREQUENCY_LABELS } from '@/lib/format';

// paid bills stay visible this long so a mistaken tap can be undone later
const SHOW_PAID_FOR_DAYS = 30;

// "Overdue · Tue, Jan 5", "Due Tomorrow" or "Paid"
function dueLine(bill: BillRecord, now: Date): string {
  const status = getBillStatus(bill, now);
  const repeats = bill.frequency ? ` · ${FREQUENCY_LABELS[bill.frequency].toLowerCase()}` : '';
  if (status === 'paid') return `Paid${repeats}`;
  if (status === 'overdue') return `Overdue · ${dayLabel(bill.dueDate, now)}${repeats}`;
  return `Due ${dayLabel(bill.dueDate, now)}${repeats}`;
}

// one bill: tap the row to edit, the round button to mark it paid or unpaid
function BillRow({ bill, now }: { bill: BillRecord; now: Date }) {
  const db = useSQLiteContext();
  const toast = useToast();
  const [ink, onCta] = useCSSVariable(['--color-ink', '--color-on-cta']) as string[];
  const overdue = getBillStatus(bill, now) === 'overdue';

  // paying logs the transaction with defaults (today, main account); unpaying removes it
  const toggle = async () => {
    if (bill.isPaid) {
      await markBillUnpaid(db, bill.id);
      return;
    }
    const paid = await markBillPaid(db, bill.id);
    if (!paid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toast({
      message: `Logged ${formatMoney(paid.amount)} from ${paid.name}`,
      actionLabel: 'Undo',
      onAction: () => void markBillUnpaid(db, bill.id),
    });
  };

  return (
    <View className="min-h-16 flex-row items-center gap-3 px-4 py-2">
      <Link href={{ pathname: '/bill', params: { id: bill.id } }} asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${bill.name}, ${formatMoney(bill.amount)}, ${dueLine(bill, now)}. Edit`}
          className="flex-1 flex-row items-center gap-3 active:opacity-70">
          <View className="flex-1">
            <Text className={`font-sans-bold text-base ${bill.isPaid ? 'text-muted' : 'text-ink'}`} numberOfLines={1}>
              {bill.name}
            </Text>
            <Text className={`text-sm ${overdue ? 'font-sans-bold text-ink' : 'font-sans text-muted'}`}>{dueLine(bill, now)}</Text>
          </View>
          <Text className={`font-display-bold text-lg tabular-nums ${bill.isPaid ? 'text-muted' : 'text-ink'}`}>
            {formatMoney(bill.amount)}
          </Text>
        </Pressable>
      </Link>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={bill.isPaid ? `Mark ${bill.name} unpaid` : `Mark ${bill.name} paid`}
        className={`h-11 w-11 items-center justify-center rounded-full border-2 border-edge ${bill.isPaid ? 'bg-cta' : 'bg-card'}`}>
        <SymbolView name="checkmark" size={16} weight="bold" tintColor={bill.isPaid ? onCta : ink} />
      </Pressable>
    </View>
  );
}

// what's already spoken for: bills here; goals (1.9) and term money (1.6) follow
export default function PlanScreen() {
  const { data } = useLiveQuery(repo.bills.list);
  const now = new Date();
  const recentCutoff = addDays(now, -SHOW_PAID_FOR_DAYS);
  const bills = sortBillsForDisplay(
    (data ?? []).filter((b) => !b.isPaid || daysBetween(recentCutoff, b.dueDate) >= 0),
    now,
  ) as BillRecord[];

  return (
    <Screen title="Plan">
      <Text className="font-display-bold text-xl text-ink">Bills</Text>
      {bills.length === 0 ? (
        <EmptyState
          stickers={[
            { emoji: '🏠', fill: 'bg-cat-sand', tilt: -1 },
            { emoji: '📱', fill: 'bg-cat-sky', tilt: 1 },
          ]}
          title="No bills yet"
          body="Add rent, your phone and subscriptions so they're set aside before your daily number."
        />
      ) : (
        <Raised>
          <View className="py-1">
            {bills.map((b) => (
              <BillRow key={b.id} bill={b} now={now} />
            ))}
          </View>
        </Raised>
      )}
      <Button label="Add a bill" kind="secondary" onPress={() => router.push('/bill')} />

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
