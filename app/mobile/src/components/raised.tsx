import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useCSSVariable } from 'uniwind';

// Sticker Book surface: a rounded card lifted off the page by a soft ledge and a wide, faint blur.
// `shape` must be a literal radius class so Tailwind can see it, e.g. "rounded-lg" or "rounded-full".
// `pressed` settles the card onto its ledge, the press feedback for every raised button and card.
export function Raised({
  shape = 'rounded-lg',
  className = '',
  surface = 'bg-card',
  pressed = false,
  children,
}: {
  shape?: string;
  className?: string;
  surface?: string;
  pressed?: boolean;
  children: ReactNode;
}) {
  const [ledge, glow] = useCSSVariable(['--color-ledge', '--color-glow']) as string[];
  const shadow = pressed ? `0 1px 0 ${ledge}, 0 2px 6px ${glow}` : `0 3px 0 ${ledge}, 0 10px 24px ${glow}`;
  return (
    <View className={className}>
      <View style={{ boxShadow: shadow }} className={`flex-1 ${surface} ${shape} ${pressed ? 'translate-y-[2px]' : ''}`}>
        {children}
      </View>
    </View>
  );
}
