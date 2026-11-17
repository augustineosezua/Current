import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';

import { Raised } from './raised';
import { Sticker, type StickerTilt } from './sticker';

const StyledSafeAreaView = withUniwind(SafeAreaView);

// page shell: themed background, safe-area top, scroll column clear of the floating tab bar
export function Screen({ title, header, children }: { title?: string; header?: ReactNode; children: ReactNode }) {
  return (
    <StyledSafeAreaView edges={['top']} className="flex-1 bg-bg">
      <ScrollView contentContainerClassName="gap-5 px-5 pb-36 pt-3">
        {header}
        {title ? <Text className="font-display text-4xl text-ink">{title}</Text> : null}
        {children}
      </ScrollView>
    </StyledSafeAreaView>
  );
}

export interface EmptySticker {
  emoji: string;
  fill: string;
  tilt: StickerTilt;
}

// kind empty state: a little sticker pile, one title, one line of what to do next
export function EmptyState({ stickers, title, body }: { stickers?: EmptySticker[]; title: string; body: string }) {
  return (
    <Raised>
      <View className="items-center gap-3 px-6 py-8">
        {stickers ? (
          <View className="mb-2 flex-row">
            {stickers.map((s) => (
              <View key={s.emoji} className="-mx-1">
                <Sticker emoji={s.emoji} fill={s.fill} tilt={s.tilt} size="lg" />
              </View>
            ))}
          </View>
        ) : null}
        <Text className="text-center font-display text-2xl text-ink">{title}</Text>
        <Text className="text-center font-sans text-base leading-6 text-muted">{body}</Text>
      </View>
    </Raised>
  );
}
