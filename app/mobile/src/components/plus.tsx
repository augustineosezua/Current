import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { t } from '@/i18n';
import { usePlus } from '@/lib/plus';

import { Button } from './form';
import { Raised } from './raised';

// small "Plus" pill next to a feature that needs it
export function PlusTag() {
  return (
    <View className="self-start rounded-full bg-brand px-2.5 py-0.5">
      <Text className="font-sans-bold text-xs text-on-brand">{t('common.plus')}</Text>
    </View>
  );
}

// open the paywall, saying where it was opened from (for the activation title and analytics)
export function openPaywall(from: string): void {
  router.push({ pathname: '/plus', params: { from } });
}

// returns a check to run before a Plus feature: true when it can go ahead, otherwise opens the paywall
export function useRequirePlus(): (from: string) => boolean {
  const isPlus = usePlus();
  return (from) => {
    if (isPlus) return true;
    openPaywall(from);
    return false;
  };
}

// a card standing in for a Plus feature on the free app: what it does, and a way to see Plus
export function PlusTeaser({ title, body, from }: { title: string; body: string; from: string }) {
  return (
    <Raised>
      <View className="gap-3 p-5">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="shrink font-display-bold text-lg text-ink">{title}</Text>
          <PlusTag />
        </View>
        <Text className="font-sans text-base leading-6 text-muted">{body}</Text>
        <Button label={t('settings.seePlus')} kind="secondary" onPress={() => openPaywall(from)} />
      </View>
    </Raised>
  );
}

// a flat row that opens a Plus feature, or the paywall on the free app, with the Plus pill until it's unlocked
export function PlusRow({ label, from, onOpen }: { label: string; from: string; onOpen: () => void }) {
  const isPlus = usePlus();
  return (
    <Pressable
      onPress={() => (isPlus ? onOpen() : openPaywall(from))}
      accessibilityRole="button"
      className="min-h-13 flex-row items-center justify-between gap-3 rounded-md bg-card p-4 active:opacity-70">
      <Text className="shrink font-sans-medium text-base text-ink">{label}</Text>
      {isPlus ? null : <PlusTag />}
    </Pressable>
  );
}
