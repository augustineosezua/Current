import { SymbolView } from 'expo-symbols';
import { Pressable } from 'react-native';
import { useCSSVariable } from 'uniwind';

// small arrow for moving a row one place up or down a list
export function MoveButton({
  direction,
  label,
  onPress,
  disabled,
}: {
  direction: 'up' | 'down';
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const ink = useCSSVariable('--color-ink') as string;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className={`h-11 w-9 items-center justify-center ${disabled ? 'opacity-25' : 'active:opacity-60'}`}>
      <SymbolView name={direction === 'up' ? 'chevron.up' : 'chevron.down'} size={16} weight="bold" tintColor={ink} />
    </Pressable>
  );
}
