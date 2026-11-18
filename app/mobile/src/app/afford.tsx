import { checkAfford, toCents, type AffordResult } from '@current/core';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { affordFigures } from '@/ai/figures';
import { AmountField, Button, Sheet } from '@/components/form';
import { Raised } from '@/components/raised';
import { useSafeToSpend } from '@/db/sts';
import { useAi } from '@/hooks/use-ai';
import { t } from '@/i18n';
import { money, untilLabel } from '@/lib/format';

// verdict surfaces reuse the daily number's moods: yes is comfortable, tight is tight, wait is the calm lilac
const VERDICT_CLASSES = {
  yes: { surface: 'bg-good', text: 'text-on-good', title: 'afford.yes' },
  tight: { surface: 'bg-tight', text: 'text-on-tight', title: 'afford.tight' },
  wait: { surface: 'bg-zero', text: 'text-on-zero', title: 'afford.wait' },
} as const;

// the plain-figures line under the verdict, worked out by core with no model involved
function verdictLines(r: AffordResult): string[] {
  if (r.verdict !== 'wait') {
    return [t('afford.daily', { now: money(r.perDayNow), after: money(r.newPerDay), date: untilLabel(r.periodEnd) })];
  }
  if (!r.waitUntil) return [t('afford.notInSight')];
  const lines = [t('afford.waitUntil', { date: untilLabel(r.waitUntil), after: money(r.newPerDay) })];
  if (r.reason === 'payday') lines.push(t('afford.payday'));
  if (r.reason === 'semester-money') lines.push(t('afford.semester'));
  return lines;
}

// 2.2: type a price, get yes / tight / wait from core, then a short explanation written from those numbers
export default function AffordScreen() {
  const { input } = useSafeToSpend();
  const ai = useAi();
  const [text, setText] = useState('');
  const [result, setResult] = useState<AffordResult | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const cents = toCents(text);
  const valid = cents !== null && cents > 0;

  // the verdict is instant; the explanation follows when a model is available
  const check = async () => {
    if (!valid || !input) return;
    const r = checkAfford(input, cents, new Date());
    setResult(r);
    setExplanation(null);
    Haptics.selectionAsync();
    if (!ai.ready && ai.availability !== 'needs-disclosure') return;
    setThinking(true);
    const answer = await ai.run({ task: 'explain', figures: affordFigures(r) });
    setThinking(false);
    setExplanation(answer?.result.explanation ?? null);
  };

  const v = result ? VERDICT_CLASSES[result.verdict] : null;

  return (
    <Sheet title={t('afford.title')}>
      <AmountField
        label={t('afford.amount')}
        value={text}
        onChangeText={(s) => {
          setText(s);
          setResult(null);
        }}
        autoFocus
      />
      <Button label={t('afford.check')} onPress={() => void check()} disabled={!valid || !input} />

      {result && v ? (
        <Raised surface={v.surface}>
          <View className="gap-2 p-5" accessibilityLiveRegion="polite">
            <Text className={`font-display text-3xl ${v.text}`}>{t(v.title)}</Text>
            {verdictLines(result).map((line) => (
              <Text key={line} className={`font-sans-medium text-base leading-6 ${v.text}`}>
                {line}
              </Text>
            ))}
          </View>
        </Raised>
      ) : null}

      {result && (thinking || explanation) ? (
        <View className="gap-2 rounded-md bg-card p-4">
          <Text className="font-sans-bold text-sm text-muted">{t('afford.why')}</Text>
          <Text className="font-sans text-base leading-6 text-ink">{explanation ?? t('afford.thinking')}</Text>
        </View>
      ) : null}
    </Sheet>
  );
}
