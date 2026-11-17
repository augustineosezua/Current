import {
  addDays,
  canAddGoal,
  canAddTermPlan,
  daysBetween,
  formatMoney,
  getBillStatus,
  getTermPlanSummary,
  isTermPlanCurrent,
  sortBillsForDisplay,
  sortGoalsByPriority,
} from '@current/core';
import * as Haptics from 'expo-haptics';
import { Link, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Button } from '@/components/form';
import { MoveButton } from '@/components/move-button';
import { Raised } from '@/components/raised';
import { EmptyState, Screen } from '@/components/screen';
import { useToast } from '@/components/toast';
import { markBillPaid, markBillUnpaid } from '@/db/ledger';
import { moveGoal } from '@/db/plan';
import type { BillRecord, GoalRecord, TermPlanRecord } from '@/db/records';
import { useSafeToSpend } from '@/db/sts';
import { dayLabel, FREQUENCY_LABELS, monthDayLabel, PERIOD_NOUNS } from '@/lib/format';

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

// term money: what's been released so far, the weekly amount and how long it lasts
function TermPlanCard({ plan, now }: { plan: TermPlanRecord; now: Date }) {
  const summary = getTermPlanSummary(plan, now);
  const ended = !isTermPlanCurrent(plan, now);
  const line = ended
    ? `Ended ${monthDayLabel(summary.endDate)}`
    : `${formatMoney(summary.released)} released so far, ${formatMoney(summary.perWeek)}/week, lasts until ${monthDayLabel(summary.endDate)}`;
  return (
    <Link href={{ pathname: '/term-plan', params: { id: plan.id } }} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={`${plan.name}, ${formatMoney(plan.amount)}. ${line}. Edit`} className="active:opacity-80">
        <Raised>
          <View className="gap-1 p-5">
            <View className="flex-row items-baseline justify-between gap-3">
              <Text className={`shrink font-display-bold text-xl ${ended ? 'text-muted' : 'text-ink'}`}>{plan.name}</Text>
              <Text className={`font-display text-2xl tabular-nums ${ended ? 'text-muted' : 'text-ink'}`}>{formatMoney(plan.amount)}</Text>
            </View>
            <Text className="font-sans text-base leading-6 text-muted">{line}</Text>
          </View>
        </Raised>
      </Pressable>
    </Link>
  );
}

// one goal: tap the row to edit or set money aside, the arrows to change which goal is funded first
function GoalRow({
  goal,
  thisPeriod,
  periodNoun,
  isFirst,
  isLast,
}: {
  goal: GoalRecord;
  // what Safe-to-Spend is holding back for this goal right now, if anything
  thisPeriod: number | null;
  periodNoun: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const db = useSQLiteContext();
  const progress = `${formatMoney(goal.amountSaved)} of ${formatMoney(goal.amount)}`;
  const detail = goal.isCompleted
    ? 'Fully saved'
    : thisPeriod
      ? `${formatMoney(thisPeriod)} held back this ${periodNoun} · by ${monthDayLabel(goal.dueDate)}`
      : `By ${monthDayLabel(goal.dueDate)}`;
  return (
    <View className="min-h-16 flex-row items-center gap-1 py-2 pl-4 pr-2">
      <Link href={{ pathname: '/goal', params: { id: goal.id } }} asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${goal.name}, ${progress}. ${detail}. Edit`}
          className="flex-1 active:opacity-70">
          <Text className={`font-sans-bold text-base ${goal.isCompleted ? 'text-muted' : 'text-ink'}`} numberOfLines={1}>
            {goal.name}
          </Text>
          <Text className="font-sans-medium text-sm tabular-nums text-ink">{progress}</Text>
          <Text className="font-sans text-sm text-muted">{detail}</Text>
        </Pressable>
      </Link>
      <MoveButton direction="up" label={`Move ${goal.name} up`} disabled={isFirst} onPress={() => void moveGoal(db, goal.id, 'up')} />
      <MoveButton direction="down" label={`Move ${goal.name} down`} disabled={isLast} onPress={() => void moveGoal(db, goal.id, 'down')} />
    </View>
  );
}

// what's already spoken for: bills, term money and goals
export default function PlanScreen() {
  const { input, result } = useSafeToSpend();
  const now = new Date();
  const recentCutoff = addDays(now, -SHOW_PAID_FOR_DAYS);
  const bills = sortBillsForDisplay(
    (input?.bills ?? []).filter((b) => !b.isPaid || daysBetween(recentCutoff, b.dueDate) >= 0),
    now,
  ) as BillRecord[];
  const termPlans = input?.termPlans ?? [];
  const goals = sortGoalsByPriority(input?.goals ?? []) as GoalRecord[];
  const heldBack = new Map((result?.goals.funded ?? []).map((g) => [g.goal.id, g.amount]));
  const periodNoun = PERIOD_NOUNS[result?.period.kind ?? 'monthly'];

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

      <Text className="font-display-bold text-xl text-ink">Term money</Text>
      {termPlans.length === 0 ? (
        <EmptyState
          stickers={[
            { emoji: '🎓', fill: 'bg-cat-lavender', tilt: -1 },
            { emoji: '🗓️', fill: 'bg-cat-butter', tilt: 2 },
          ]}
          title="Got a lump sum for the term?"
          body="Add it and we'll spread it over the weeks it has to last, so it's still there in April."
        />
      ) : (
        termPlans.map((p) => <TermPlanCard key={p.id} plan={p} now={now} />)
      )}
      {canAddTermPlan(termPlans, now) ? (
        <Button label="Add term money" kind="secondary" onPress={() => router.push('/term-plan')} />
      ) : (
        <Text className="text-center font-sans text-sm text-muted">One lot of term money at a time for now.</Text>
      )}

      <Text className="font-display-bold text-xl text-ink">Goals</Text>
      {goals.length === 0 ? (
        <EmptyState
          stickers={[
            { emoji: '✈️', fill: 'bg-cat-sky', tilt: -2 },
            { emoji: '🎯', fill: 'bg-cat-butter', tilt: 1 },
            { emoji: '💻', fill: 'bg-cat-lilac', tilt: 2 },
          ]}
          title="Nothing saved for yet"
          body="A trip, a laptop, or just a cushion? Add it and we'll hold a little back every paycheque."
        />
      ) : (
        <>
          <Raised>
            <View className="py-1">
              {goals.map((g, i) => (
                <GoalRow
                  key={g.id}
                  goal={g}
                  thisPeriod={heldBack.get(g.id) ?? null}
                  periodNoun={periodNoun}
                  isFirst={i === 0}
                  isLast={i === goals.length - 1}
                />
              ))}
            </View>
          </Raised>
          {goals.length > 1 ? (
            <Text className="text-center font-sans text-sm text-muted">The goal at the top is funded first.</Text>
          ) : null}
        </>
      )}
      {canAddGoal(goals) ? (
        <Button label="Add a goal" kind="secondary" onPress={() => router.push('/goal')} />
      ) : (
        <Text className="text-center font-sans text-sm text-muted">Two goals at a time for now.</Text>
      )}
    </Screen>
  );
}
