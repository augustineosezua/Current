import { addDays, daysBetween, toCents } from '@current/core';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { AmountField, Button, Chips, Field, Sheet } from '@/components/form';
import { openPaywall, PlusTag } from '@/components/plus';
import { useToast } from '@/components/toast';
import { allocateToGoal, deleteGoal, saveGoal, withdrawFromGoal } from '@/db/plan';
import type { GoalRecord, TransactionRecord } from '@/db/records';
import * as repo from '@/db/repo';
import { useLiveQuery } from '@/hooks/use-live-query';
import { t } from '@/i18n';
import { money, shortDate } from '@/lib/format';
import { usePlus } from '@/lib/plus';

// recent purchases a withdrawal can be linked to
const PURCHASE_WINDOW_DAYS = 14;
const MAX_PURCHASES = 6;

interface FormData {
  goal: GoalRecord | null;
  hasSavingsAccount: boolean;
  // recent spending, newest first, for "What did it pay for?"
  recent: TransactionRecord[];
}

// the goal being edited, whether set-aside money has a savings account to land in, and recent spending
async function loadForm(db: SQLiteDatabase, id: string | undefined): Promise<FormData> {
  const [goal, accounts, transactions] = await Promise.all([id ? repo.goals.get(db, id) : null, repo.accounts.list(db), repo.transactions.list(db)]);
  const since = addDays(new Date(), -PURCHASE_WINDOW_DAYS);
  const recent = transactions
    .filter((tx) => tx.amount > 0 && !tx.goalId && !tx.createdFromBill && daysBetween(since, tx.date) >= 0)
    .slice(0, MAX_PURCHASES);
  return { goal, hasSavingsAccount: accounts.some((a) => a.type === 'savings'), recent };
}

// 2.4 (Plus): take money back out, optionally saying what it paid for
function TakeOut({ goal, recent, onDone }: { goal: GoalRecord; recent: TransactionRecord[]; onDone: (task: () => Promise<void>) => void }) {
  const db = useSQLiteContext();
  const toast = useToast();
  const isPlus = usePlus();
  const [text, setText] = useState('');
  const [purchase, setPurchase] = useState<string>('none');
  const amount = toCents(text);

  if (!isPlus) {
    return (
      <Pressable onPress={() => openPaywall('goal-withdraw')} accessibilityRole="button" className="flex-row items-center justify-between rounded-md bg-card p-4 active:opacity-70">
        <Text className="font-sans-medium text-base text-ink">{t('goal.takeOut')}</Text>
        <PlusTag />
      </Pressable>
    );
  }

  const take = () =>
    onDone(async () => {
      if (amount === null || amount <= 0) return;
      const moved = await withdrawFromGoal(db, goal.id, amount, { purchaseId: purchase === 'none' ? null : purchase });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      toast({ message: t('goal.took', { amount: money(moved), goal: goal.name }) });
    });

  return (
    <View className="gap-5 border-t-2 border-field pt-5">
      <Text className="font-display-bold text-xl text-ink">{t('goal.takeOut')}</Text>
      <Text className="font-sans text-base leading-6 text-muted">{t('goal.takeOutBody', { saved: money(goal.amountSaved) })}</Text>
      <AmountField label={t('common.howMuch')} value={text} onChangeText={setText} />
      {recent.length > 0 ? (
        <Chips
          label={t('goal.paidFor')}
          options={[
            { value: 'none', label: t('goal.nothingSpecific') },
            ...recent.map((tx) => ({ value: tx.id, label: `${tx.merchantName ?? t('activity.spending')} · ${money(tx.amount)} · ${shortDate(tx.date)}` })),
          ]}
          value={purchase}
          onChange={setPurchase}
        />
      ) : null}
      <Button label={t('goal.takeIt')} kind="secondary" onPress={take} disabled={amount === null || amount <= 0} />
    </View>
  );
}

// add or edit a goal; an unfinished goal can also have money set aside for it
function GoalForm({ goal, hasSavingsAccount, recent }: FormData) {
  const db = useSQLiteContext();
  const toast = useToast();
  const isPlus = usePlus();
  const [name, setName] = useState(goal?.name ?? '');
  const [amountText, setAmountText] = useState(goal ? (goal.amount / 100).toFixed(2) : '');
  const [dueDate, setDueDate] = useState<Date | null>(goal?.dueDate ?? null);
  const [asideText, setAsideText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const amount = toCents(amountText);
  const valid = name.trim().length > 0 && amount !== null && amount > 0 && dueDate !== null;
  const aside = toCents(asideText);

  // run a write, close the sheet, and surface a failure instead of losing it
  const run = async (task: () => Promise<void>) => {
    try {
      await task();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // create or update the goal's details; Plus has no limit on how many
  const save = () =>
    run(async () => {
      if (!valid) return;
      await saveGoal(db, goal?.id ?? null, { name: name.trim(), amount, dueDate }, isPlus);
    });

  // move money out of spending and count it towards the goal
  const setAside = () =>
    run(async () => {
      if (!goal || aside === null || aside <= 0) return;
      const moved = await allocateToGoal(db, goal.id, aside);
      if (moved === 0) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      toast({ message: t('goal.added', { amount: money(moved), goal: goal.name }) });
    });

  const progress = { saved: money(goal?.amountSaved ?? 0), target: money(goal?.amount ?? 0) };

  return (
    <Sheet title={goal ? t('goal.edit') : t('goal.add')}>
      <Field label={t('goal.whatFor')} value={name} onChangeText={setName} placeholder={t('goal.placeholder')} autoFocus={!goal} />
      <AmountField label={t('common.howMuch')} value={amountText} onChangeText={setAmountText} />
      <DateField label={t('goal.byWhen')} value={dueDate} onChange={setDueDate} />
      {error ? <Text className="font-sans-medium text-base text-ink">{t('common.didntSave', { error })}</Text> : null}
      <Button label={t('common.save')} onPress={save} disabled={!valid} />

      {goal && !goal.isCompleted ? (
        <View className="gap-5 border-t-2 border-field pt-5">
          <Text className="font-display-bold text-xl text-ink">{t('goal.putIn')}</Text>
          <Text className="font-sans text-base leading-6 text-muted">
            {hasSavingsAccount ? t('goal.putInSavings', progress) : t('goal.putInNoSavings', progress)}
          </Text>
          <AmountField label={t('goal.howMuchNow')} value={asideText} onChangeText={setAsideText} />
          <Button label={t('goal.addIt')} kind="secondary" onPress={setAside} disabled={aside === null || aside <= 0} />
        </View>
      ) : null}
      {goal && goal.amountSaved > 0 ? <TakeOut goal={goal} recent={recent} onDone={(task) => void run(task)} /> : null}
      {goal ? <Button label={t('goal.delete')} kind="plain" onPress={() => run(() => deleteGoal(db, goal.id))} /> : null}
    </Sheet>
  );
}

// add-goal sheet, or edit with ?id=
export default function GoalScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const load = useCallback((db: SQLiteDatabase) => loadForm(db, id), [id]);
  const { data } = useLiveQuery(load, false);

  if (!data) return <Sheet title="">{null}</Sheet>;
  return <GoalForm {...data} />;
}
