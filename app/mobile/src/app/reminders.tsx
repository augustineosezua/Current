import { DEFAULT_REMINDER_SETTINGS, type ReminderSettings } from '@current/core';
import * as Linking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { Button } from '@/components/form';
import { Raised } from '@/components/raised';
import { Screen } from '@/components/screen';
import { saveSetting } from '@/db/plan';
import * as repo from '@/db/repo';
import { useLiveQuery } from '@/hooks/use-live-query';
import { t } from '@/i18n';
import { getReminderPermission, requestReminderPermission, syncReminders, type ReminderPermission } from '@/lib/reminders';

const TOGGLES: readonly { key: keyof ReminderSettings; title: string; body: string }[] = [
  { key: 'bills', title: t('reminders.bills'), body: t('reminders.billsBody') },
  { key: 'summary', title: t('reminders.summary'), body: t('reminders.summaryBody') },
  { key: 'checkIn', title: t('reminders.checkIn'), body: t('reminders.checkInBody') },
];

// one reminder with its switch
function ToggleRow({ title, body, value, onChange }: { title: string; body: string; value: boolean; onChange: (on: boolean) => void }) {
  return (
    <View className="min-h-16 flex-row items-center gap-3 px-5 py-3">
      <View className="flex-1">
        <Text className="font-sans-bold text-base text-ink">{title}</Text>
        <Text className="font-sans text-sm text-muted">{body}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={title} />
    </View>
  );
}

// which local notifications to send; never more than one a day
export default function RemindersScreen() {
  const db = useSQLiteContext();
  const { data: settings } = useLiveQuery(repo.getSettings);
  const [permission, setPermission] = useState<ReminderPermission | null>(null);

  // re-check on focus, since the answer can change in iPhone Settings
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getReminderPermission()
        .then((p) => active && setPermission(p))
        .catch(() => {});
      return () => {
        active = false;
      };
    }, []),
  );

  // ask iOS, then schedule straight away if the answer was yes
  const allow = async () => {
    const next = await requestReminderPermission();
    setPermission(next);
    if (next === 'granted') await syncReminders(db);
  };

  const reminders = { ...DEFAULT_REMINDER_SETTINGS, ...settings?.reminders };

  return (
    <Screen header={<BackButton />} title={t('reminders.title')}>
      {permission === 'ask' ? (
        <View className="gap-3 rounded-md bg-card p-4">
          <Text className="font-sans-medium text-base text-ink">{t('reminders.off')}</Text>
          <Button label={t('reminders.turnOn')} kind="secondary" onPress={() => void allow()} />
        </View>
      ) : null}
      {permission === 'denied' ? (
        <View className="gap-3 rounded-md bg-card p-4">
          <Text className="font-sans-medium text-base text-ink">{t('reminders.blocked')}</Text>
          <Button label={t('reminders.openSettings')} kind="secondary" onPress={() => void Linking.openSettings()} />
        </View>
      ) : null}

      <Raised>
        <View className="py-1">
          {TOGGLES.map((toggle) => (
            <ToggleRow
              key={toggle.key}
              title={toggle.title}
              body={toggle.body}
              value={reminders[toggle.key]}
              onChange={(on) => void saveSetting(db, 'reminders', { ...reminders, [toggle.key]: on })}
            />
          ))}
        </View>
      </Raised>
      <Text className="text-center font-sans text-sm text-muted">{t('reminders.note')}</Text>
    </Screen>
  );
}
