import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { t } from '@/i18n';

// round chevron that goes back one screen
export function BackButton() {
  const ink = useCSSVariable('--color-ink') as string;
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      className="h-11 w-11 items-center justify-center rounded-full bg-field active:opacity-70">
      <SymbolView name="chevron.left" size={18} weight="semibold" tintColor={ink} />
    </Pressable>
  );
}
