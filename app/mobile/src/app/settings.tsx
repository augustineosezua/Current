import { Link, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { Button } from '@/components/form';
import { Raised } from '@/components/raised';
import { Screen } from '@/components/screen';
import { saveSetting } from '@/db/plan';
import { exportTransactions } from '@/lib/export';

const ROWS: readonly { href: Href; title: string; body: string }[] = [
  { href: '/budget', title: 'Budget', body: 'By paycheque, month or term, and when you get paid.' },
  { href: '/accounts', title: 'Accounts', body: 'Balances, check-ins, and adding cash or savings.' },
  { href: '/categories', title: 'Categories', body: 'Rename them, change their stickers, or add your own.' },
  { href: '/reminders', title: 'Reminders', body: 'Bills coming up, your Sunday summary and balance checks.' },
];

// a card that opens another settings screen
function SettingsLink({ href, title, body }: { href: Href; title: string; body: string }) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="button" className="active:opacity-80">
        <Raised>
          <View className="gap-1 p-5">
            <Text className="font-display-bold text-lg text-ink">{title}</Text>
            <Text className="font-sans text-base text-muted">{body}</Text>
          </View>
        </Raised>
      </Pressable>
    </Link>
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
          <Text className="font-display-bold text-lg text-ink">Your budget lives on your phone</Text>
          <Text className="font-sans text-base leading-6 text-muted">
            No account. No bank login. It&apos;s included in iCloud device backups, and you can export everything you&apos;ve logged
            as a CSV any time.
          </Text>
        </View>
        {error ? <Text className="font-sans-medium text-base text-ink">Couldn&apos;t export: {error}</Text> : null}
        <Button label="Export CSV" kind="secondary" onPress={exportCsv} />
      </View>
    </Raised>
  );
}

// settings: one card per area
export default function SettingsScreen() {
  return (
    <Screen header={<BackButton />} title="Settings">
      {ROWS.map((row) => (
        <SettingsLink key={row.title} {...row} />
      ))}
      <BackupCard />
    </Screen>
  );
}
