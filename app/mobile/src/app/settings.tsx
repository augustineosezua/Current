import { Link, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Raised } from '@/components/raised';
import { Screen } from '@/components/screen';

// back to home
function BackButton() {
  const ink = useCSSVariable('--color-ink') as string;
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Back"
      className="h-11 w-11 items-center justify-center rounded-full bg-field">
      <SymbolView name="chevron.left" size={18} weight="semibold" tintColor={ink} />
    </Pressable>
  );
}

// settings: accounts for now; more rows arrive with later items
export default function SettingsScreen() {
  return (
    <Screen header={<BackButton />} title="Settings">
      <Link href="/accounts" asChild>
        <Pressable accessibilityRole="button" className="active:opacity-80">
          <Raised>
            <View className="gap-1 p-5">
              <Text className="font-display-bold text-lg text-ink">Accounts</Text>
              <Text className="font-sans text-base text-muted">Balances, check-ins, and adding cash or savings.</Text>
            </View>
          </Raised>
        </Pressable>
      </Link>
      <Raised>
        <View className="gap-1 p-5">
          <Text className="font-display-bold text-lg text-ink">Your budget lives on your phone</Text>
          <Text className="font-sans text-base text-muted">No account. No bank login.</Text>
        </View>
      </Raised>
    </Screen>
  );
}
