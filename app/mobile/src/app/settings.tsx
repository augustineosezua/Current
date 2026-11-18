import { Link, router, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { CLOUD_AI_ENABLED, useAiAvailability } from '@/ai';
import { BackButton } from '@/components/back-button';
import { Button } from '@/components/form';
import { openPaywall, PlusTag } from '@/components/plus';
import { Raised } from '@/components/raised';
import { Screen } from '@/components/screen';
import { saveSetting } from '@/db/plan';
import * as repo from '@/db/repo';
import { useLiveQuery } from '@/hooks/use-live-query';
import { t } from '@/i18n';
import { DEBUG_TOOLS } from '@/lib/debug';
import { exportTransactions } from '@/lib/export';
import { manageSubscription, restorePlus, usePlus } from '@/lib/plus';

const ROWS: readonly { href: Href; title: string; body: string; plus?: string }[] = [
  { href: '/budget', title: t('settings.budget'), body: t('settings.budgetBody') },
  { href: '/accounts', title: t('settings.accounts'), body: t('settings.accountsBody') },
  { href: '/categories', title: t('settings.categories'), body: t('settings.categoriesBody') },
  { href: '/reminders', title: t('settings.reminders'), body: t('settings.remindersBody') },
  { href: '/appearance', title: t('settings.appearance'), body: t('settings.appearanceBody'), plus: 'appearance' },
  { href: '/import', title: t('settings.import'), body: t('settings.importBody'), plus: 'import' },
];

// a card that opens another settings screen; Plus ones open the paywall on the free app
function SettingsLink({ href, title, body, plus }: { href: Href; title: string; body: string; plus?: string }) {
  const isPlus = usePlus();
  const locked = !!plus && !isPlus;
  return (
    <Pressable accessibilityRole="button" onPress={() => (locked ? openPaywall(plus) : router.push(href))}>
      {({ pressed }) => (
        <Raised pressed={pressed}>
          <View className="gap-1 p-5">
            <View className="flex-row items-center justify-between gap-3">
              <Text className="shrink font-display-bold text-lg text-ink">{title}</Text>
              {locked ? <PlusTag /> : null}
            </View>
            <Text className="font-sans text-base text-muted">{body}</Text>
          </View>
        </Raised>
      )}
    </Pressable>
  );
}

// Current Plus: what it is and a way in, or that it's on and how to manage it
function PlusCard() {
  const isPlus = usePlus();
  const [note, setNote] = useState<string | null>(null);
  const restore = async () => {
    try {
      setNote((await restorePlus()) ? null : t('plus.restoredNone'));
    } catch (e) {
      setNote(t('plus.buyError', { error: e instanceof Error ? e.message : String(e) }));
    }
  };
  return (
    <Raised surface="bg-good">
      <View className="gap-3 p-5">
        <Text className="font-display-bold text-lg text-on-good">{t('settings.plusTitle')}</Text>
        <Text className="font-sans text-base leading-6 text-on-good">{isPlus ? t('settings.plusActive') : t('settings.plusBody')}</Text>
        {isPlus ? (
          <Button label={t('settings.manage')} kind="secondary" onPress={() => void manageSubscription()} />
        ) : (
          <>
            <Button label={t('settings.seePlus')} onPress={() => openPaywall('settings')} />
            <Button label={t('settings.restore')} kind="plain" onPress={() => void restore()} />
          </>
        )}
        {note ? <Text className="font-sans-medium text-base text-on-good">{note}</Text> : null}
      </View>
    </Raised>
  );
}

// 2.9: the Cloud AI switch, shown only on iPhones that can't run the model themselves
function CloudAiCard() {
  const db = useSQLiteContext();
  const availability = useAiAvailability();
  const { data: settings } = useLiveQuery(repo.getSettings);
  if (!CLOUD_AI_ENABLED || !settings || availability === null || availability === 'on-device') return null;
  return (
    <Raised>
      <View className="flex-row items-center gap-3 p-5">
        <View className="flex-1 gap-1">
          <Text className="font-display-bold text-lg text-ink">{t('settings.cloudAi')}</Text>
          <Text className="font-sans text-sm leading-5 text-muted">{t('settings.cloudAiBody')}</Text>
        </View>
        <Switch
          value={settings.cloudAi}
          accessibilityLabel={t('settings.cloudAi')}
          onValueChange={(on) => {
            void saveSetting(db, 'cloudAi', on);
            // switching it on here counts as reading the disclosure, which the card repeats word for word
            if (on && !settings.cloudAiDisclosedAt) void saveSetting(db, 'cloudAiDisclosedAt', new Date().toISOString());
          }}
        />
      </View>
    </Raised>
  );
}

// where the data lives, and a CSV copy of everything logged
function BackupCard() {
  const db = useSQLiteContext();
  const [error, setError] = useState<string | null>(null);

  // share the CSV, and count it as this month's backup
  const exportCsv = async () => {
    try {
      setError(null);
      await exportTransactions(db);
      await saveSetting(db, 'backupNudgedAt', new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Raised>
      <View className="gap-3 p-5">
        <View className="gap-1">
          <Text className="font-display-bold text-lg text-ink">{t('settings.localTitle')}</Text>
          <Text className="font-sans text-base leading-6 text-muted">{t('settings.localBody')}</Text>
        </View>
        {error ? <Text className="font-sans-medium text-base text-ink">{t('settings.exportError', { error })}</Text> : null}
        <Button label={t('settings.exportCsv')} kind="secondary" onPress={exportCsv} />
      </View>
    </Raised>
  );
}

// testing tools (DEBUG_TOOLS): pretend Plus is on, and the AI test set
function DevCard() {
  const db = useSQLiteContext();
  const { data: settings } = useLiveQuery(repo.getSettings);
  if (!DEBUG_TOOLS || !settings) return null;
  return (
    <View className="gap-3 rounded-md bg-card p-4">
      <View className="flex-row items-center gap-3">
        <Text className="flex-1 font-sans text-sm text-muted">{t('settings.devPlus')}</Text>
        <Switch value={settings.devPlus} onValueChange={(on) => void saveSetting(db, 'devPlus', on)} />
      </View>
      <Link href="/ai-eval" asChild>
        <Pressable accessibilityRole="button">
          <Text className="font-sans-medium text-sm text-ink underline">{t('settings.aiTest')}</Text>
        </Pressable>
      </Link>
    </View>
  );
}

// settings: one card per area
export default function SettingsScreen() {
  return (
    <Screen header={<BackButton />} title={t('settings.title')}>
      <PlusCard />
      {ROWS.map((row) => (
        <SettingsLink key={row.title} {...row} />
      ))}
      <CloudAiCard />
      <BackupCard />
      <DevCard />
    </Screen>
  );
}
