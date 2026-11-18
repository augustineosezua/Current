import { toCents, type Frequency } from '@current/core';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';

import { DateField } from '@/components/date-field';
import { AmountField, Button, Chips, Field } from '@/components/form';
import { completeOnboarding, type BillInput } from '@/db/ledger';
import { requestReminderPermission } from '@/lib/reminders';
import { t } from '@/i18n';
import { dayLabel, frequencyLabel, money } from '@/lib/format';

const StyledSafeAreaView = withUniwind(SafeAreaView);

const PAY_FREQUENCIES: readonly { value: Frequency; label: string }[] = (
  ['weekly', 'biweekly', 'semimonthly', 'monthly', 'one_time'] as const
).map((value) => ({ value, label: frequencyLabel(value) }));

const BILL_REPEATS: readonly { value: Frequency; label: string }[] = (['monthly', 'one_time'] as const).map((value) => ({
  value,
  label: frequencyLabel(value),
}));

// first run: balance, next income, bills. No signup, and the next screen is the number.
export default function OnboardingScreen() {
  const db = useSQLiteContext();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [balanceText, setBalanceText] = useState('');
  const balance = toCents(balanceText);

  const [payText, setPayText] = useState('');
  const [payFrequency, setPayFrequency] = useState<Frequency>('biweekly');
  const [payDate, setPayDate] = useState<Date | null>(null);
  const pay = toCents(payText);
  const hasIncome = pay !== null && pay > 0 && payDate !== null;

  const [bills, setBills] = useState<BillInput[]>([]);
  const [billName, setBillName] = useState('');
  const [billText, setBillText] = useState('');
  const [billDue, setBillDue] = useState<Date | null>(null);
  const [billRepeats, setBillRepeats] = useState<Frequency>('monthly');
  const billAmount = toCents(billText);
  const draftBill: BillInput | null =
    billName.trim() && billAmount !== null && billAmount > 0 && billDue
      ? { name: billName.trim(), amount: billAmount, dueDate: billDue, frequency: billRepeats }
      : null;

  // keep the typed bill and clear the form for the next one
  const addBill = () => {
    if (!draftBill) return;
    setBills([...bills, draftBill]);
    setBillName('');
    setBillText('');
    setBillDue(null);
  };

  // write everything at once (a half-typed valid bill counts), then show the number
  const finish = async () => {
    if (balance === null) return;
    try {
      await completeOnboarding(db, {
        balance,
        income: hasIncome ? { amount: pay, frequency: payFrequency, nextPaymentDate: payDate } : null,
        bills: draftBill ? [...bills, draftBill] : bills,
      });
      // with a bill to remind about, this is the moment the notification prompt makes sense
      if (draftBill || bills.length > 0) void requestReminderPermission().catch(() => {});
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView contentContainerClassName="gap-5 px-5 pb-10 pt-6" keyboardShouldPersistTaps="handled">
          <Text className="font-sans-bold text-sm text-muted">{t('onboarding.step', { step: step + 1 })}</Text>

          {step === 0 ? (
            <>
              <Text className="font-display text-4xl text-ink">{t('onboarding.balanceTitle')}</Text>
              <Text className="font-sans text-base leading-6 text-muted">{t('onboarding.balanceBody')}</Text>
              <AmountField label={t('onboarding.balance')} value={balanceText} onChangeText={setBalanceText} autoFocus allowNegative />
              <Button label={t('common.next')} onPress={() => setStep(1)} disabled={balance === null} />
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Text className="font-display text-4xl text-ink">{t('onboarding.payTitle')}</Text>
              <Text className="font-sans text-base leading-6 text-muted">{t('onboarding.payBody')}</Text>
              <AmountField label={t('common.howMuch')} value={payText} onChangeText={setPayText} autoFocus />
              <Chips label={t('onboarding.howOften')} options={PAY_FREQUENCIES} value={payFrequency} onChange={setPayFrequency} />
              <DateField label={t('onboarding.nextPayday')} value={payDate} onChange={setPayDate} />
              <Button label={t('common.next')} onPress={() => setStep(2)} disabled={!hasIncome} />
              <Button
                label={t('onboarding.skipPay')}
                kind="plain"
                onPress={() => {
                  setPayText('');
                  setStep(2);
                }}
              />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text className="font-display text-4xl text-ink">{t('onboarding.billsTitle')}</Text>
              <Text className="font-sans text-base leading-6 text-muted">{t('onboarding.billsBody')}</Text>
              {bills.map((b, i) => (
                <View key={i} className="flex-row items-center justify-between rounded-md bg-card p-4">
                  <Text className="shrink font-sans-bold text-base text-ink">
                    {b.name} <Text className="font-sans text-muted">· {dayLabel(b.dueDate)}</Text>
                  </Text>
                  <Text className="font-display-bold text-lg tabular-nums text-ink">{money(b.amount)}</Text>
                </View>
              ))}
              <Field label={t('common.whatIsIt')} value={billName} onChangeText={setBillName} placeholder={t('onboarding.billPlaceholder')} />
              <AmountField label={t('common.howMuch')} value={billText} onChangeText={setBillText} />
              <DateField label={t('onboarding.nextDue')} value={billDue} onChange={setBillDue} />
              <Chips label={t('onboarding.repeats')} options={BILL_REPEATS} value={billRepeats} onChange={setBillRepeats} />
              <Button label={t('onboarding.addAnother')} kind="secondary" onPress={addBill} disabled={!draftBill} />
              {error ? <Text className="font-sans-medium text-base text-ink">{t('common.didntSave', { error })}</Text> : null}
              <Button label={t('onboarding.finish')} onPress={finish} />
            </>
          ) : null}

          {step > 0 ? <Button label={t('common.back')} kind="plain" onPress={() => setStep(step - 1)} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </StyledSafeAreaView>
  );
}
