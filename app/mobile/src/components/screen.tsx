import * as Haptics from 'expo-haptics';
import { Children, Fragment, isValidElement, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCSSVariable, withUniwind } from 'uniwind';

import { notifyChange } from '@/db/live';

import { glide, rise, stickerPop } from './motion';
import { Raised } from './raised';
import { Sticker, type StickerTilt } from './sticker';

const StyledSafeAreaView = withUniwind(SafeAreaView);

// long enough for the spinner to read as "done", short enough not to feel slow; the reload itself is local and instant
const REFRESH_MS = 450;

// pull down to re-read everything and recalculate as of right now
function usePullToRefresh(): { refreshing: boolean; onRefresh: () => void } {
  const [refreshing, setRefreshing] = useState(false);

  // let the spinner settle, then stop it
  useEffect(() => {
    if (!refreshing) return;
    const timer = setTimeout(() => setRefreshing(false), REFRESH_MS);
    return () => clearTimeout(timer);
  }, [refreshing]);

  const onRefresh = () => {
    setRefreshing(true);
    notifyChange();
    Haptics.selectionAsync();
  };
  return { refreshing, onRefresh };
}

// a screen's top-level blocks, with fragments opened up so each item keeps the column's gap; keys stay unique
function blocks(node: ReactNode, prefix = ''): { key: string; child: ReactNode }[] {
  return Children.toArray(node).flatMap((child, i) => {
    const key = `${prefix}${isValidElement(child) && child.key != null ? child.key : i}`;
    if (isValidElement(child) && child.type === Fragment) {
      return blocks((child as ReactElement<{ children?: ReactNode }>).props.children, `${key}/`);
    }
    return [{ key, child }];
  });
}

// page shell: themed background, safe-area top, scroll column clear of the floating tab bar, pull to refresh
export function Screen({ title, header, children }: { title?: string; header?: ReactNode; children: ReactNode }) {
  const ink = useCSSVariable('--color-ink') as string;
  const { refreshing, onRefresh } = usePullToRefresh();
  return (
    <StyledSafeAreaView edges={['top']} className="flex-1 bg-bg">
      <ScrollView
        contentContainerClassName="gap-5 px-5 pb-36 pt-3"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ink} />}>
        {/* each block rises in turn when the screen first opens, and glides when one above it appears or goes */}
        {blocks([header, title ? <Text className="font-display text-4xl text-ink">{title}</Text> : null, children]).map(
          ({ key, child }, i) => (
            <Animated.View key={key} entering={rise(i)} layout={glide}>
              {child}
            </Animated.View>
          ),
        )}
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
            {stickers.map((s, i) => (
              <Animated.View key={s.emoji} entering={stickerPop(i)} style={{ marginHorizontal: -4 }}>
                <Sticker emoji={s.emoji} fill={s.fill} tilt={s.tilt} size="lg" />
              </Animated.View>
            ))}
          </View>
        ) : null}
        <Text className="text-center font-display text-2xl text-ink">{title}</Text>
        <Text className="text-center font-sans text-base leading-6 text-muted">{body}</Text>
      </View>
    </Raised>
  );
}
