import { Text, View } from 'react-native';

import { Sticker } from '@/components/sticker';

// log spending sheet (the form is built in 1.1)
export default function AddScreen() {
  return (
    <View className="flex-1 gap-4 bg-bg px-5 pt-8">
      <Text className="font-display text-3xl text-ink">Log spending</Text>
      <View className="flex-row items-center gap-3">
        <Sticker emoji="☕" fill="bg-cat-peach" tilt={-1} />
        <Text className="flex-1 font-sans text-base text-muted">The quick-log form lands in the next build.</Text>
      </View>
    </View>
  );
}
