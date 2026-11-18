import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { useCSSVariable } from 'uniwind';

import { Button, Sheet } from '@/components/form';
import { Raised } from '@/components/raised';
import { saveSetting } from '@/db/plan';
import { t, type MessageKey } from '@/i18n';
import { track } from '@/lib/analytics';
import { buyPlus, getPlusOffer, restorePlus, usePlus, type PlusOffer } from '@/lib/plus';

// Apple's standard licence agreement, and the app's privacy policy (set EXPO_PUBLIC_PRIVACY_URL)
const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;

// every Plus feature, AI ones included: the cloud fallback makes them work on every iPhone
const FEATURES: readonly { emoji: string; key: MessageKey }[] = [
  { emoji: '✍️', key: 'plus.f.quickAdd' },
  { emoji: '🤔', key: 'plus.f.afford' },
  { emoji: '💬', key: 'plus.f.ask' },
  { emoji: '📬', key: 'plus.f.recap' },
  { emoji: '🎯', key: 'plus.f.limits' },
  { emoji: '📊', key: 'plus.f.insights' },
  { emoji: '♾️', key: 'plus.f.unlimited' },
  { emoji: '📥', key: 'plus.f.import' },
  { emoji: '🎨', key: 'plus.f.themes' },
];

// whether a package carries Apple's free-trial introductory offer
function hasTrial(pkg: PurchasesPackage | null): boolean {
  return !!pkg?.product.introPrice && pkg.product.introPrice.price === 0;
}

// one plan option; the chosen one gets the ink ring
function PlanOption({
  title,
  line,
  selected,
  onPress,
}: {
  title: string;
  line: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={`${title}, ${line}`}>
      <View className={`gap-0.5 rounded-md border-2 bg-card p-4 ${selected ? 'border-ink' : 'border-field'}`}>
        <Text className="font-display-bold text-lg text-ink">{title}</Text>
        <Text className="font-sans-medium text-base text-muted">{line}</Text>
      </View>
    </Pressable>
  );
}

// the paywall: what Plus adds, yearly (with the trial) or monthly, restore and the fine print
export default function PlusScreen() {
  const db = useSQLiteContext();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const isPlus = usePlus();
  const ink = useCSSVariable('--color-ink') as string;
  const [offer, setOffer] = useState<PlusOffer | null | undefined>(undefined);
  const [choice, setChoice] = useState<'annual' | 'monthly'>('annual');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // load prices, and remember a paywall was shown so the review prompt keeps away from it
  useEffect(() => {
    track('paywall_shown', { from: from ?? 'unknown' });
    void saveSetting(db, 'paywallShownAt', new Date().toISOString());
    getPlusOffer().then(setOffer);
  }, [db, from]);

  const pkg = offer ? (choice === 'annual' ? offer.annual : offer.monthly) ?? offer.annual ?? offer.monthly : null;
  const trial = choice === 'annual' && hasTrial(offer?.annual ?? null);

  // buy, and close on success; backing out of Apple's sheet is not an error
  const buy = async () => {
    if (!pkg) return;
    setBusy(true);
    setMessage(null);
    try {
      if (await buyPlus(pkg)) {
        track(trial ? 'trial_started' : 'purchase', { plan: choice });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      }
    } catch (e) {
      setMessage(t('plus.buyError', { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (await restorePlus()) router.back();
      else setMessage(t('plus.restoredNone'));
    } catch (e) {
      setMessage(t('plus.buyError', { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const purchase = isPlus ? null : (
    <>
      {offer === undefined ? (
        <ActivityIndicator color={ink} />
      ) : !offer ? (
        <Text className="font-sans-medium text-base text-ink">{t('plus.unavailable')}</Text>
      ) : (
        <>
          <View accessibilityRole="radiogroup" className="gap-3">
            {offer.annual ? (
              <PlanOption
                title={t('plus.yearly')}
                line={
                  hasTrial(offer.annual)
                    ? t('plus.trialLine', { price: offer.annual.product.priceString })
                    : t('plus.perYear', { price: offer.annual.product.priceString })
                }
                selected={choice === 'annual'}
                onPress={() => setChoice('annual')}
              />
            ) : null}
            {offer.monthly ? (
              <PlanOption
                title={t('plus.monthly')}
                line={t('plus.perMonth', { price: offer.monthly.product.priceString })}
                selected={choice === 'monthly' || !offer.annual}
                onPress={() => setChoice('monthly')}
              />
            ) : null}
          </View>
          <Button label={trial ? t('plus.startTrial') : t('plus.subscribe')} onPress={buy} disabled={busy || !pkg} />
        </>
      )}

      {message ? <Text className="font-sans-medium text-base text-ink">{message}</Text> : null}
    </>
  );

  return (
    <Sheet title={from === 'activation' && !isPlus ? t('plus.trialTitle') : t('plus.title')}>
      {isPlus ? <Text className="font-sans-medium text-lg leading-7 text-ink">{t('plus.active')}</Text> : null}
      {/* plans and the buy button first, so they're on screen without scrolling; the feature list follows */}
      {purchase}

      <Raised>
        <View className="gap-3 p-5">
          <Text className="font-sans-bold text-base text-ink">{t('plus.intro')}</Text>
          {FEATURES.map((f) => (
            <View key={f.key} className="flex-row gap-3">
              <Text className="text-lg">{f.emoji}</Text>
              <Text className="flex-1 font-sans text-base leading-6 text-ink">{t(f.key)}</Text>
            </View>
          ))}
          <Text className="font-sans text-sm leading-5 text-muted">{t('plus.aiNote')}</Text>
        </View>
      </Raised>

      {isPlus && message ? <Text className="font-sans-medium text-base text-ink">{message}</Text> : null}
      {isPlus ? null : <Button label={t('plus.restore')} kind="plain" onPress={restore} disabled={busy} />}
      {from === 'activation' && !isPlus ? <Button label={t('common.notNow')} kind="plain" onPress={() => router.back()} /> : null}

      <Text className="text-center font-sans text-xs leading-5 text-muted">{t('plus.fine')}</Text>
      <View className="flex-row justify-center gap-6">
        <Pressable accessibilityRole="link" onPress={() => void WebBrowser.openBrowserAsync(TERMS_URL)} hitSlop={8}>
          <Text className="font-sans-medium text-sm text-muted underline">{t('plus.terms')}</Text>
        </Pressable>
        {PRIVACY_URL ? (
          <Pressable accessibilityRole="link" onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_URL)} hitSlop={8}>
            <Text className="font-sans-medium text-sm text-muted underline">{t('plus.privacy')}</Text>
          </Pressable>
        ) : null}
      </View>
    </Sheet>
  );
}
