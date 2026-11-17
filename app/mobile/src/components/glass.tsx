import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useCSSVariable } from 'uniwind';

const LIQUID_GLASS = isLiquidGlassAvailable();

// Apple liquid glass for controls that float over content (tab pill, + button, quick-add).
// iOS 26+ draws the real material; older systems get a solid card on the soft ledge so it never goes see-through.
// `radius` is a number because the native glass view clips to it directly.
export function Glass({
  radius,
  tint,
  interactive = false,
  style,
  children,
}: {
  radius: number;
  // a colour for tinted glass, e.g. the brand coral on the + button
  tint?: string;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const [card, ledge, glow] = useCSSVariable(['--color-card', '--color-ledge', '--color-glow']) as string[];

  if (!LIQUID_GLASS) {
    return (
      <View
        style={[
          {
            borderRadius: radius,
            backgroundColor: tint ?? card,
            boxShadow: `0 3px 0 ${ledge}, 0 10px 24px ${glow}`,
          },
          style,
        ]}>
        {children}
      </View>
    );
  }

  return (
    <GlassView
      glassEffectStyle="regular"
      tintColor={tint}
      isInteractive={interactive}
      style={[
        {
          borderRadius: radius,
          overflow: 'hidden',
          boxShadow: `0 10px 24px ${glow}`,
        },
        style,
      ]}>
      {children}
    </GlassView>
  );
}
