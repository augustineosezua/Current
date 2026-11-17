import { formatMoney, toCents } from '@current/core';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { AmountField, Button, Field, Sheet } from '@/components/form';
import { useToast } from '@/components/toast';
import { allocateToGoal, deleteGoal, saveGoal } from '@/db/plan';
import type { GoalRecord } from '@/db/records';
import * as repo from '@/db/repo';
import { useLiveQuery } from '@/hooks/use-live-query';

interface FormData {
  goal: GoalRecord | null;
  hasSavingsAccount: boolean;
}

// the goal being edited, and whether set-aside money has a savings account to land in
async function loadForm(db: SQLiteDatabase, id: string | undefined): Promise<FormData> {
  const [goal, accounts] = await Promise.all([id ? repo.goals.get(db, id) : null, repo.accounts.list(db)]);
  return { goal, hasSavingsAccount: accounts.some((a) => a.type === 'savings') };
}

// add or edit a goal; an unfinished goal can also have money set aside for it
function GoalForm({ goal, hasSavingsAccount }: FormData) {
  const db = useSQLiteContext();
  const toast = useToast();
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

  // create or update the goal's details
  const save = () =>
    run(async () => {
      if (!valid) return;
      await saveGoal(db, goal?.id ?? null, { name: name.trim(), amount, dueDate });
    });

  // move money out of spending and count it towards the goal
  const setAside = () =>
    run(async () => {
      if (!goal || aside === null || aside <= 0) return;
      const moved = await allocateToGoal(db, goal.id, aside);
      if (moved === 0) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      toast({ message: `Added ${formatMoney(moved)} to ${goal.name}` });
    });

  return (
    <Sheet title={goal ? 'Edit goal' : 'Add a goal'}>
      <Field label="What's it for?" value={name} onChangeText={setName} placeholder="Laptop" autoFocus={!goal} />
      <AmountField label="How much?" value={amountText} onChangeText={setAmountText} />
      <DateField label="By when?" value={dueDate} onChange={setDueDate} />
      {error ? <Text className="font-sans-medium text-base text-ink">That didn&apos;t save: {error}</Text> : null}
      <Button label="Save" onPress={save} disabled={!valid} />

      {goal && !goal.isCompleted ? (
        <View className="gap-5 border-t-2 border-field pt-5">
          <Text className="font-display-bold text-xl text-ink">Put money in</Text>
          <Text className="font-sans text-base leading-6 text-muted">
            {formatMoney(goal.amountSaved)} of {formatMoney(goal.amount)} so far.{' '}
            {hasSavingsAccount
              ? 'Move it to savings in your bank app, then log it here.'
              : 'Put it somewhere you won’t spend it, then log it here. It comes out of your balance.'}
          </Text>
          <AmountField label="How much now?" value={asideText} onChangeText={setAsideText} />
          <Button label="Add it" kind="secondary" onPress={setAside} disabled={aside === null || aside <= 0} />
        </View>
      ) : null}
      {goal ? <Button label="Delete goal" kind="plain" onPress={() => run(() => deleteGoal(db, goal.id))} /> : null}
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
