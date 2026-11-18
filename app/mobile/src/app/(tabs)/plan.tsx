import {
  addDays,
  canAddGoal,
  canAddTermPlan,
  daysBetween,
  getBillStatus,
  getNeedsWantsSplit,
  getTermPlanSummary,
  isTermPlanCurrent,
  sortBillsForDisplay,
  sortGoalsByPriority,
  type StsResult,
} from '@current/core';
import * as Haptics from 'expo-haptics';
import { Link, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Button } from '@/components/form';
import { MoveButton } from '@/components/move-button';
import { Pop, Row } from '@/components/motion';
import { PlusRow, PlusTeaser } from '@/components/plus';
import { Raised } from '@/components/raised';
import { EmptyState, Screen } from '@/components/screen';
import { Sticker } from '@/components/sticker';
import { useToast } from '@/components/toast';
import { markBillPaid, markBillUnpaid } from '@/db/ledger';
import { moveGoal } from '@/db/plan';
import type { BillRecord, GoalRecord, TermPlanRecord } from '@/db/records';
import { useSafeToSpend, type BudgetData } from '@/db/sts';
import { t } from '@/i18n';
import { budgetStatuses } from '@/lib/budget-status';
import { categoryName, fillFor } from '@/lib/categories';
import { dayLabel, frequencyLabel, money, monthDayLabel, periodPhrase } from '@/lib/format';
import { usePlus } from '@/lib/plus';

// paid bills stay visible this long so a mistaken tap can be undone later
const SHOW_PAID_FOR_DAYS = 30;

// "Overdue · Tue, Jan 5", "Due Tomorrow" or "Paid"
function dueLine(bill: BillRecord, now: Date): string {
  const status = getBillStatus(bill, now);
  const repeats = bill.frequency ? ` · ${frequencyLabel(bill.frequency).toLowerCase()}` : '';
  if (status === 'paid') return `${t('plan.paid')}${repeats}`;
  if (status === 'overdue') return `${t('plan.overdue', { day: dayLabel(bill.dueDate, now) })}${repeats}`;
  return `${t('plan.due', { day: dayLabel(bill.dueDate, now) })}${repeats}`;
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
      message: t('plan.paidToast', { bill: paid.name, amount: money(paid.amount) }),
      actionLabel: t('common.undo'),
      onAction: () => void markBillUnpaid(db, bill.id),
    });
  };

  return (
    <View className="min-h-16 flex-row items-center gap-3 px-4 py-2">
      <Link href={{ pathname: '/bill', params: { id: bill.id } }} asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.edit', { label: `${bill.name}, ${money(bill.amount)}, ${dueLine(bill, now)}` })}
          className="flex-1 flex-row items-center gap-3 active:opacity-70">
          <View className="flex-1">
            <Text className={`font-sans-bold text-base ${bill.isPaid ? 'text-muted' : 'text-ink'}`} numberOfLines={1}>
              {bill.name}
            </Text>
            <Text className={`text-sm ${overdue ? 'font-sans-bold text-ink' : 'font-sans text-muted'}`}>{dueLine(bill, now)}</Text>
          </View>
          <Text className={`font-display-bold text-lg tabular-nums ${bill.isPaid ? 'text-muted' : 'text-ink'}`}>{money(bill.amount)}</Text>
        </Pressable>
      </Link>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={bill.isPaid ? t('plan.markUnpaid', { bill: bill.name }) : t('plan.markPaid', { bill: bill.name })}
        className={`h-11 w-11 items-center justify-center rounded-full border-2 ${bill.isPaid ? 'border-transparent bg-cta' : 'border-field bg-card'}`}>
        <Pop trigger={bill.isPaid} enabled={bill.isPaid} to={1.5}>
          <SymbolView name="checkmark" size={16} weight="bold" tintColor={bill.isPaid ? onCta : ink} />
        </Pop>
      </Pressable>
    </View>
  );
}

// term money: what's been released so far, the weekly amount and how long it lasts
function TermPlanCard({ plan, now }: { plan: TermPlanRecord; now: Date }) {
  const summary = getTermPlanSummary(plan, now);
  const ended = !isTermPlanCurrent(plan, now);
  const line = ended
    ? t('plan.termEnded', { date: monthDayLabel(summary.endDate) })
    : t('plan.termLine', { perWeek: money(summary.perWeek), released: money(summary.released), date: monthDayLabel(summary.endDate) });
  return (
    <Link href={{ pathname: '/term-plan', params: { id: plan.id } }} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.edit', { label: `${plan.name}, ${money(plan.amount)}. ${line}` })}>
        {({ pressed }) => (
          <Raised pressed={pressed}>
            <View className="gap-1 p-5">
              <View className="flex-row items-baseline justify-between gap-3">
                <Text className={`shrink font-display-bold text-lg ${ended ? 'text-muted' : 'text-ink'}`}>{plan.name}</Text>
                <Text className={`font-display text-2xl tabular-nums ${ended ? 'text-muted' : 'text-ink'}`}>{money(plan.amount)}</Text>
              </View>
              <Text className="font-sans text-base leading-6 text-muted">{line}</Text>
            </View>
          </Raised>
        )}
      </Pressable>
    </Link>
  );
}

// one goal: tap the row to edit or set money aside, the arrows to change which goal is funded first
function GoalRow({
  goal,
  thisPeriod,
  thisPeriodLabel,
  isFirst,
  isLast,
}: {
  goal: GoalRecord;
  // what Safe-to-Spend is holding back for this goal right now, if anything
  thisPeriod: number | null;
  thisPeriodLabel: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const db = useSQLiteContext();
  const progress = t('plan.goalProgress', { saved: money(goal.amountSaved), target: money(goal.amount) });
  const detail = goal.isCompleted
    ? t('plan.goalDone')
    : thisPeriod
      ? t('plan.goalThisPeriod', { amount: money(thisPeriod), thisPeriod: thisPeriodLabel, date: monthDayLabel(goal.dueDate) })
      : t('plan.goalBy', { date: monthDayLabel(goal.dueDate) });
  return (
    <View className="min-h-16 flex-row items-center gap-1 py-2 pl-4 pr-2">
      <Link href={{ pathname: '/goal', params: { id: goal.id } }} asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.edit', { label: `${goal.name}, ${progress}. ${detail}` })}
          className="flex-1 active:opacity-70">
          <Text className={`font-sans-bold text-base ${goal.isCompleted ? 'text-muted' : 'text-ink'}`} numberOfLines={1}>
            {goal.name}
          </Text>
          <Text className="font-sans-medium text-sm tabular-nums text-ink">{progress}</Text>
          <Text className="font-sans text-sm text-muted">{detail}</Text>
        </Pressable>
      </Link>
      <MoveButton direction="up" label={t('common.moveUp', { name: goal.name })} disabled={isFirst} onPress={() => void moveGoal(db, goal.id, 'up')} />
      <MoveButton direction="down" label={t('common.moveDown', { name: goal.name })} disabled={isLast} onPress={() => void moveGoal(db, goal.id, 'down')} />
    </View>
  );
}

// 2.3 (Plus): each category limit this period, with the needs/wants split above
function LimitsSection({ input, result }: { input: BudgetData; result: StsResult }) {
  const isPlus = usePlus();
  if (!isPlus) return <PlusTeaser title={t('plan.limits')} body={t('plan.limitsTeaser')} from="limits" />;

  const statuses = budgetStatuses(input, result);
  const categories = new Map(input.categories.map((c) => [c.id, c]));
  const split = getNeedsWantsSplit(input.transactions, input.categories, input.categoryBudgets, result.period, new Date());
  const kindLine = (k: { spent: number; limit: number }) => (k.limit > 0 ? t('plan.limitOf', { spent: money(k.spent), available: money(k.limit) }) : money(k.spent));

  return (
    <>
      {statuses.length === 0 ? (
        <EmptyState
          stickers={[
            { emoji: '🍔', fill: 'bg-cat-peach', tilt: -1 },
            { emoji: '🛍️', fill: 'bg-cat-coral', tilt: 2 },
          ]}
          title={t('plan.limitsEmptyTitle')}
          body={t('plan.limitsEmptyBody')}
        />
      ) : (
        <Raised>
          <View className="gap-1 py-2">
            <Text className="px-4 pb-1 font-sans-bold text-sm text-muted">
              {t('plan.needsWants', { needs: kindLine(split.needs), wants: kindLine(split.wants) })}
            </Text>
            {statuses.map((s) => {
              const category = categories.get(s.categoryId);
              if (!category) return null;
              const over = s.left < 0;
              const pct = s.available > 0 ? Math.min(100, Math.round((s.spent * 100) / s.available)) : 100;
              return (
                <Link key={s.categoryId} href={{ pathname: '/category-budget', params: { categoryId: s.categoryId } }} asChild>
                  <Pressable accessibilityRole="button" className="gap-2 px-4 py-2 active:opacity-70">
                    <View className="flex-row items-center gap-3">
                      <Sticker emoji={category.emoji} fill={fillFor(category.color)} size="sm" />
                      <View className="flex-1">
                        <Text className="font-sans-bold text-base text-ink" numberOfLines={1}>
                          {categoryName(category)}
                        </Text>
                        <Text className="font-sans text-sm tabular-nums text-muted">
                          {t('plan.limitOf', { spent: money(s.spent), available: money(s.available) })}
                          {s.carry > 0 ? ` · ${t('plan.limitCarryIn', { amount: money(s.carry) })}` : ''}
                          {s.carry < 0 ? ` · ${t('plan.limitCarryOut', { amount: money(-s.carry) })}` : ''}
                        </Text>
                      </View>
                      <Text className={`text-base tabular-nums text-ink ${over ? 'font-sans-bold' : 'font-sans-medium'}`}>
                        {over ? t('plan.limitOver', { amount: money(-s.left) }) : t('plan.limitLeft', { amount: money(s.left) })}
                      </Text>
                    </View>
                    {/* progress bar: ink once it's past the limit, never red */}
                    <View className="h-2 overflow-hidden rounded-full bg-field">
                      <View style={{ width: `${pct}%` }} className={`h-full rounded-full ${s.threshold > 0 ? 'bg-cta' : fillFor(category.color)}`} />
                    </View>
                  </Pressable>
                </Link>
              );
            })}
          </View>
        </Raised>
      )}
      <Button label={t('plan.setLimit')} kind="secondary" onPress={() => router.push('/category-budget')} />
      {statuses.length > 0 ? <Text className="text-center font-sans text-sm text-muted">{t('plan.limitsNote')}</Text> : null}
    </>
  );
}

// what's already spoken for: bills, term money, goals and category limits
export default function PlanScreen() {
  const { input, result } = useSafeToSpend();
  const isPlus = usePlus();
  const now = new Date();
  const recentCutoff = addDays(now, -SHOW_PAID_FOR_DAYS);
  const bills = sortBillsForDisplay(
    (input?.bills ?? []).filter((b) => !b.isPaid || daysBetween(recentCutoff, b.dueDate) >= 0),
    now,
  ) as BillRecord[];
  const termPlans = input?.termPlans ?? [];
  const goals = sortGoalsByPriority(input?.goals ?? []) as GoalRecord[];
  const heldBack = new Map((result?.goals.funded ?? []).map((g) => [g.goal.id, g.amount]));
  const thisPeriodLabel = periodPhrase(result?.period.kind ?? 'monthly', 'thisLower');

  return (
    <Screen title={t('plan.title')}>
      <Text className="font-display-bold text-xl text-ink">{t('plan.bills')}</Text>
      {bills.length === 0 ? (
        <EmptyState
          stickers={[
            { emoji: '🏠', fill: 'bg-cat-sand', tilt: -1 },
            { emoji: '📱', fill: 'bg-cat-sky', tilt: 1 },
          ]}
          title={t('plan.billsEmptyTitle')}
          body={t('plan.billsEmptyBody')}
        />
      ) : (
        <Raised>
          <View className="py-1">
            {bills.map((b) => (
              <Row key={b.id}>
                <BillRow bill={b} now={now} />
              </Row>
            ))}
          </View>
        </Raised>
      )}
      <Button label={t('plan.addBill')} kind="secondary" onPress={() => router.push('/bill')} />

      <Text className="font-display-bold text-xl text-ink">{t('plan.term')}</Text>
      {termPlans.length === 0 ? (
        <EmptyState
          stickers={[
            { emoji: '🎓', fill: 'bg-cat-lavender', tilt: -1 },
            { emoji: '🗓️', fill: 'bg-cat-butter', tilt: 2 },
          ]}
          title={t('plan.termEmptyTitle')}
          body={t('plan.termEmptyBody')}
        />
      ) : (
        termPlans.map((p) => <TermPlanCard key={p.id} plan={p} now={now} />)
      )}
      {canAddTermPlan(termPlans, now, isPlus) ? (
        <Button label={t('plan.addTerm')} kind="secondary" onPress={() => router.push('/term-plan')} />
      ) : (
        <PlusRow label={`${t('plan.oneTerm')} ${t('plan.moreWithPlus')}`} from="term-limit" onOpen={() => router.push('/term-plan')} />
      )}

      <Text className="font-display-bold text-xl text-ink">{t('plan.goals')}</Text>
      {goals.length === 0 ? (
        <EmptyState
          stickers={[
            { emoji: '✈️', fill: 'bg-cat-sky', tilt: -2 },
            { emoji: '🎯', fill: 'bg-cat-butter', tilt: 1 },
            { emoji: '💻', fill: 'bg-cat-lilac', tilt: 2 },
          ]}
          title={t('plan.goalsEmptyTitle')}
          body={t('plan.goalsEmptyBody')}
        />
      ) : (
        <>
          <Raised>
            <View className="py-1">
              {goals.map((g, i) => (
                <Row key={g.id}>
                  <GoalRow
                    goal={g}
                    thisPeriod={heldBack.get(g.id) ?? null}
                    thisPeriodLabel={thisPeriodLabel}
                    isFirst={i === 0}
                    isLast={i === goals.length - 1}
                  />
                </Row>
              ))}
            </View>
          </Raised>
          {goals.length > 1 ? <Text className="text-center font-sans text-sm text-muted">{t('plan.topGoalFirst')}</Text> : null}
        </>
      )}
      {canAddGoal(goals, isPlus) ? (
        <Button label={t('plan.addGoal')} kind="secondary" onPress={() => router.push('/goal')} />
      ) : (
        <PlusRow label={`${t('plan.threeGoals')} ${t('plan.moreWithPlus')}`} from="goal-limit" onOpen={() => router.push('/goal')} />
      )}

      <Text className="font-display-bold text-xl text-ink">{t('plan.limits')}</Text>
      {input && result ? <LimitsSection input={input} result={result} /> : null}
    </Screen>
  );
}
