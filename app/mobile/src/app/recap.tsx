import { getWeeklyRecap } from '@current/core';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { recapFigures } from '@/ai/figures';
import { BackButton } from '@/components/back-button';
import { PlusTeaser } from '@/components/plus';
import { Raised } from '@/components/raised';
import { Screen } from '@/components/screen';
import { useSafeToSpend } from '@/db/sts';
import { useAi } from '@/hooks/use-ai';
import { t } from '@/i18n';
import { monthDayLabel } from '@/lib/format';
import { usePlus } from '@/lib/plus';

// 2.10 (Plus): the week in figures from core, and three or four sentences the AI layer writes from them
export default function RecapScreen() {
  const isPlus = usePlus();
  const { input } = useSafeToSpend();
  const ai = useAi();
  // the prose written for a set of figures, keyed by them so new numbers get a new recap
  const [written, setWritten] = useState<{ key: string; prose: string | null } | null>(null);

  const recap = input ? getWeeklyRecap(input, new Date()) : null;
  const figures = recap && input ? recapFigures(recap, input) : [];
  const key = figures.map((f) => f.value).join('|');

  // write the recap once per set of figures; with no model it stays as figures only
  useEffect(() => {
    if (!isPlus || !ai.ready || !key) return;
    let active = true;
    ai.run({ task: 'recap', figures }).then((answer) => {
      if (active) setWritten({ key, prose: answer?.result.recap ?? null });
    });
    return () => {
      active = false;
    };
    // figures are derived from key; re-run only when the numbers change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlus, ai.ready, key]);

  const prose = written?.key === key ? written.prose : null;
  const writing = isPlus && ai.ready && !!key && written?.key !== key;

  if (!isPlus) {
    return (
      <Screen header={<BackButton />} title={t('recap.title')}>
        <PlusTeaser title={t('recap.title')} body={t('plus.f.recap')} from="recap" />
      </Screen>
    );
  }
  if (!recap) return <Screen header={<BackButton />} title={t('recap.title')}>{null}</Screen>;

  return (
    <Screen header={<BackButton />} title={t('recap.title')}>
      <Text className="font-sans-bold text-sm text-muted">
        {t('recap.range', { start: monthDayLabel(recap.start), end: monthDayLabel(recap.end) })}
      </Text>
      <Raised>
        <View className="gap-2 p-5" accessibilityLiveRegion="polite">
          <Text className="font-sans-medium text-lg leading-7 text-ink">
            {prose ?? (writing ? t('recap.writing') : t('recap.noAi'))}
          </Text>
        </View>
      </Raised>
      <Raised>
        <View className="gap-2 p-5">
          {figures.slice(1).map((f) => (
            <View key={f.label} className="flex-row items-baseline justify-between gap-3">
              <Text className="shrink font-sans text-base text-muted">{f.label}</Text>
              <Text className="shrink text-right font-sans-medium text-base tabular-nums text-ink">{f.value}</Text>
            </View>
          ))}
        </View>
      </Raised>
    </Screen>
  );
}
