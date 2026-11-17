import { Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

// literal class lists so Tailwind can see them
const SIZES = {
  sm: 'h-9 w-9 rounded-[11px]',
  md: 'h-11 w-11 rounded-[14px]',
  lg: 'h-20 w-20 rounded-[24px]',
} as const;
const EMOJI = { sm: 'text-lg', md: 'text-xl', lg: 'text-4xl' } as const;
const TILTS = ['-rotate-6', '-rotate-3', 'rotate-0', 'rotate-3', 'rotate-6'] as const;

export type StickerTilt = -2 | -1 | 0 | 1 | 2;

// die-cut category sticker: emoji on a colour fill, a white edge, a soft ledge shadow and a slight tilt
export function Sticker({
  emoji,
  fill,
  size = 'md',
  tilt = 0,
}: {
  emoji: string;
  // a bg-cat-* class from global.css
  fill: string;
  size?: keyof typeof SIZES;
  tilt?: StickerTilt;
}) {
  const ledge = useCSSVariable('--color-ledge') as string;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ boxShadow: `0 2px 0 ${ledge}` }}
      className={`items-center justify-center border-2 border-edge ${SIZES[size]} ${fill} ${TILTS[tilt + 2]}`}>
      <Text className={EMOJI[size]}>{emoji}</Text>
    </View>
  );
}
