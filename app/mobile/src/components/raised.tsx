import type { ReactNode } from 'react';
import { View } from 'react-native';

// Sticker Book surface: ink outline with a hard offset shadow (the look that sets it apart from soft pastel apps).
// `shape` must be a literal radius class so Tailwind can see it, e.g. "rounded-lg" or "rounded-full".
export function Raised({
  shape = 'rounded-lg',
  className = '',
  surface = 'bg-card',
  children,
}: {
  shape?: string;
  className?: string;
  surface?: string;
  children: ReactNode;
}) {
  return (
    <View className={`relative ${className}`}>
      <View className={`absolute inset-0 translate-x-[3px] translate-y-[3px] bg-edge ${shape}`} />
      <View className={`flex-1 border-2 border-edge ${surface} ${shape}`}>{children}</View>
    </View>
  );
}
