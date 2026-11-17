import { formatMoneyWhole, getStsMood, type StsMood, type StsResult } from '@current/core';
import { Text, View } from 'react-native';

import { useCountUp } from '@/hooks/use-count-up';

import { Raised } from './raised';

// literal classes per mood so Tailwind can see them
const MOOD_CLASSES: Record<StsMood, { surface: string; text: string; tilt: string }> = {
  comfortable: { surface: 'bg-good', text: 'text-on-good', tilt: '-rotate-1' },
  tight: { surface: 'bg-tight', text: 'text-on-tight', tilt: 'rotate-1' },
  zero: { surface: 'bg-zero', text: 'text-on-zero', tilt: 'rotate-0' },
};

const weekday = new Intl.DateTimeFormat('en-CA', { weekday: 'long' });
const shortDate = new Intl.DateTimeFormat('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });

// one line of copy per mood: short, second person, never guilt
export function moodLine(result: StsResult, mood: StsMood): string {
  const day = weekday.format(result.daily.periodEnd);
  const total = formatMoneyWhole(result.safeToSpend);
  if (mood === 'comfortable') return `You're in good shape. That's ${total} until ${day}.`;
  if (mood === 'tight') return `Tight, but it gets you to ${day}. ${total} in all.`;
  const next = result.availableAfter;
  return next && next.amount > 0
    ? `Nothing spare right now. About ${formatMoneyWhole(next.amount)} frees up ${shortDate.format(next.date)}.`
    : 'Nothing spare right now.';
}

// the home headline: daily Safe-to-Spend on a sticker card whose colour follows its mood
export function StsHero({ result }: { result: StsResult }) {
  const mood = getStsMood(result);
  const c = MOOD_CLASSES[mood];
  const perDay = useCountUp(result.daily.perDay);

  return (
    <Raised shape="rounded-lg" surface={c.surface} className={c.tilt}>
      <View className="gap-2 p-6" accessible accessibilityLabel={`Safe to spend today: ${formatMoneyWhole(result.daily.perDay)} a day. ${moodLine(result, mood)}`}>
        <Text className={`font-sans-bold text-base ${c.text}`}>Safe to spend today</Text>
        <Text className={`font-display text-sts tabular-nums tracking-tighter ${c.text}`} numberOfLines={1} adjustsFontSizeToFit>
          {formatMoneyWhole(perDay)}
          <Text className="font-display-bold text-3xl tracking-normal">/day</Text>
        </Text>
        <Text className={`font-sans-medium text-lg leading-6 ${c.text}`}>{moodLine(result, mood)}</Text>
      </View>
    </Raised>
  );
}
