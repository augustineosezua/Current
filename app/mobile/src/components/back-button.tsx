import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable } from 'react-native';
import { useCSSVariable } from 'uniwind';

// round chevron that goes back one screen
export function BackButton() {
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
