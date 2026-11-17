import { Text, View } from 'react-native';

import { Screen } from '@/components/screen';

// settings (filled in by later items)
export default function SettingsScreen() {
  return (
    <Screen title="Settings">
      <View className="gap-2 rounded-md bg-surface p-6">
        <Text className="font-sans-bold text-lg text-white">Your budget lives on your phone</Text>
        <Text className="font-sans text-base text-white/70">No account. No bank login.</Text>
      </View>
    </Screen>
  );
}
