import { useEffect, useRef, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  ZoomIn,
  type SharedValue,
} from 'react-native-reanimated';

// Shared motion for the whole app. Everything here follows the system Reduce Motion setting:
// with it on, things simply appear in place (DESIGN.md "Motion and haptics").
const SYSTEM = ReduceMotion.System;

// cap the stagger so long screens don't keep the last card waiting
const STAGGER_MS = 30;
const MAX_STAGGER = 4;

// a screen's blocks rise into place one after another, the first time the screen opens
export function rise(index: number) {
  return FadeInDown.delay(Math.min(index, MAX_STAGGER) * STAGGER_MS)
    .springify()
    .damping(26)
    .stiffness(220)
    .reduceMotion(SYSTEM);
}

// rows added to or removed from a list fade, and the rows around them glide to make room
export const rowIn = FadeIn.duration(180).reduceMotion(SYSTEM);
export const rowOut = FadeOut.duration(140).reduceMotion(SYSTEM);
export const glide = LinearTransition.springify().damping(28).stiffness(260).reduceMotion(SYSTEM);

// stickers pop in with a little overshoot, staggered across a pile
export function stickerPop(index: number) {
  return ZoomIn.delay(80 + index * 45)
    .springify()
    .damping(16)
    .stiffness(240)
    .reduceMotion(SYSTEM);
}

// a list row with enter, exit and glide-into-place
export function Row({ children }: { children: ReactNode }) {
  return (
    <Animated.View entering={rowIn} exiting={rowOut} layout={glide}>
      {children}
    </Animated.View>
  );
}

// springs the scale down while pressed and back on release; wire `pressIn`/`pressOut` to a Pressable
export function usePressScale(to = 0.98) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const spring = { damping: 22, stiffness: 340, reduceMotion: SYSTEM };
  return {
    style,
    pressIn: () => {
      scale.set(withSpring(to, spring));
    },
    pressOut: () => {
      scale.set(withSpring(1, spring));
    },
  };
}

// a quick bounce whenever `trigger` changes after the first render (paid checkmark, newly selected tab)
export function Pop({
  trigger,
  enabled = true,
  to = 1.12,
  style,
  children,
}: {
  trigger: unknown;
  // bounce only when this is true, e.g. a tab becoming selected but not deselected
  enabled?: boolean;
  to?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const scale = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (enabled) bounce(scale, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bounce on trigger changes only
  }, [trigger]);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

function bounce(scale: SharedValue<number>, to: number) {
  scale.value = withSequence(
    withSpring(to, { damping: 14, stiffness: 420, reduceMotion: SYSTEM }),
    withSpring(1, { damping: 18, stiffness: 300, reduceMotion: SYSTEM }),
  );
}
