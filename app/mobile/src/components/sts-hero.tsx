import { getStsMood, type StsMood, type StsResult } from '@current/core';
import { Text, View } from 'react-native';

import type { Settings } from '@/db/records';
import { useCountUp } from '@/hooks/use-count-up';
import { t } from '@/i18n';
import { moneyWhole, shortDate, untilLabel } from '@/lib/format';

import { Raised } from './raised';

// literal classes per mood so Tailwind can see them
const MOOD_CLASSES: Record<StsMood, { surface: string; text: string; tilt: string }> = {
  comfortable: { surface: 'bg-good', text: 'text-on-good', tilt: '-rotate-1' },
  tight: { surface: 'bg-tight', text: 'text-on-tight', tilt: 'rotate-1' },
  zero: { surface: 'bg-zero', text: 'text-on-zero', tilt: 'rotate-0' },
};

// one line of copy per mood: short, second person, never guilt (used by notifications and screen readers)
export function moodLine(result: StsResult, mood: StsMood): string {
  const date = untilLabel(result.daily.periodEnd);
  const total = moneyWhole(result.safeToSpend);
  if (mood === 'comfortable') return t('hero.comfortable', { total, date });
  if (mood === 'tight') return t('hero.tight', { total, date });
  return zeroLine(result);
}

// with nothing spare, say when money opens up instead of showing a second zero
function zeroLine(result: StsResult): string {
  const next = result.availableAfter;
  return next && next.amount > 0
    ? t('hero.zeroWithNext', { amount: moneyWhole(next.amount), date: shortDate(next.date) })
    : t('hero.zero');
}

// the home headline on a sticker card whose colour follows its mood. The big number is per day or the whole
// amount until the budget ends (a setting), the line under it is the other one, and the end date sits top right.
export function StsHero({ result, show = 'perDay' }: { result: StsResult; show?: Settings['heroAmount'] }) {
  const mood = getStsMood(result);
  const c = MOOD_CLASSES[mood];
  const perDay = useCountUp(result.daily.perDay);
  const total = useCountUp(result.safeToSpend);
  const byDay = show === 'perDay';
  const until = t('hero.until', { date: shortDate(result.daily.periodEnd) });
  const other =
    mood === 'zero' ? zeroLine(result) : byDay ? t('hero.otherTotal', { amount: moneyWhole(total) }) : t('hero.otherPerDay', { amount: moneyWhole(perDay) });

  return (
    <Raised shape="rounded-lg" surface={c.surface} className={c.tilt}>
      <View
        className="gap-2 p-6"
        accessible
        accessibilityLabel={t(byDay ? 'hero.a11y' : 'hero.a11yTotal', {
          amount: moneyWhole(byDay ? result.daily.perDay : result.safeToSpend),
          date: untilLabel(result.daily.periodEnd),
          line: other,
        })}>
        <View className="flex-row items-baseline justify-between gap-3">
          <Text className={`shrink font-sans-bold text-base ${c.text}`}>{byDay ? t('hero.title') : t('hero.titleTotal')}</Text>
          <Text className={`font-sans-bold text-sm opacity-80 ${c.text}`}>{until}</Text>
        </View>
        <Text className={`font-display text-sts tabular-nums tracking-tighter ${c.text}`} numberOfLines={1} adjustsFontSizeToFit>
          {moneyWhole(byDay ? perDay : total)}
          {byDay ? <Text className="font-display-bold text-3xl tracking-normal">{t('hero.perDay')}</Text> : null}
        </Text>
        <Text className={`font-sans-bold text-xl tabular-nums ${c.text}`}>{other}</Text>
      </View>
    </Raised>
  );
}
