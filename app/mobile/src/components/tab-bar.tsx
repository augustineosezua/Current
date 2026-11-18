import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useState, type ComponentRef, type Ref } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';

import { t } from '@/i18n';

import { Glass } from './glass';
import { Pop } from './motion';
import { Sticker } from './sticker';

const TABS: {
  name: string;
  label: string;
  icon: SFSymbol;
  iconSelected: SFSymbol;
}[] = [
  { name: 'index', label: t('tab.home'), icon: 'house', iconSelected: 'house.fill' },
  {
    name: 'activity',
    label: t('tab.activity'),
    icon: 'list.bullet',
    iconSelected: 'list.bullet',
  },
  { name: 'plan', label: t('tab.plan'), icon: 'calendar', iconSelected: 'calendar' },
];

// half of iOS's ~500ms context-menu hold
const HOLD_MS = 250;

// sizes shared by the bar and the quick-add stack (bar sits 28 from the bottom, + is 72 wide)
const BAR_BOTTOM = 28;
const PLUS_SIZE = 72;
const BUBBLE_SIZE = 56;

// what holding + offers, listed top to bottom; the last sits nearest the thumb. Kept to four so it never
// covers the screen. Tapping + already logs spending; payday and accounts live in Settings.
const QUICK_ADD: { label: string; emoji: string; fill: string; href: Href }[] = [
  {
    label: t('quick.term'),
    emoji: '🎓',
    fill: 'bg-cat-lilac',
    href: '/term-plan',
  },
  { label: t('quick.goal'), emoji: '🎯', fill: 'bg-cat-butter', href: '/goal' },
  { label: t('quick.bill'), emoji: '🧾', fill: 'bg-cat-sand', href: '/bill' },
  {
    label: t('quick.moneyIn'),
    emoji: '💸',
    fill: 'bg-cat-mint',
    href: { pathname: '/add', params: { direction: 'in' } },
  },
];

// one tab in the pill; TabTrigger passes isFocused and the press handler
function TabButton({
  isFocused,
  label,
  icon,
  iconSelected,
  ref,
  // TabTrigger injects { flexDirection: 'row', justifyContent: 'space-between' }, which would override
  // className and split icon and label to opposite edges, so drop it
  style: _triggerStyle,
  ...props
}: TabTriggerSlotProps & {
  label: string;
  icon: SFSymbol;
  iconSelected: SFSymbol;
}) {
  const [ink, muted] = useCSSVariable(['--color-ink', '--color-muted']) as string[];
  return (
    <Pressable
      {...props}
      onPressIn={() => {
        if (!isFocused) Haptics.selectionAsync();
      }}
      // TabTriggerSlotProps types the ref as View's component type; RN 0.88's Pressable wants the element
      ref={ref as unknown as Ref<ComponentRef<typeof Pressable>>}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      className="flex-1 items-center justify-center gap-0.5">
      <Pop trigger={isFocused} enabled={!!isFocused} to={1.1}>
        <SymbolView name={isFocused ? iconSelected : icon} size={22} tintColor={isFocused ? ink : muted} />
      </Pop>
      <Text className={`text-[11px] ${isFocused ? 'font-sans-bold text-ink' : 'font-sans-medium text-muted'}`}>{label}</Text>
    </Pressable>
  );
}

// the stack that rises out of + after a hold: a glass label and a glass bubble holding the app's sticker
function QuickAdd({ onPick }: { onPick: (href: Href) => void }) {
  const last = QUICK_ADD.length - 1;
  return (
    <View pointerEvents="box-none" style={styles.stack}>
      {QUICK_ADD.map((item, i) => (
        <Animated.View
          key={item.label}
          // rise from the button, nearest first
          entering={FadeInDown.delay((last - i) * 25)
            .springify()
            .damping(24)
            .reduceMotion(ReduceMotion.System)}
          exiting={FadeOutDown.duration(120).reduceMotion(ReduceMotion.System)}>
          <Pressable
            onPress={() => onPick(item.href)}
            accessibilityRole="button"
            accessibilityLabel={t('quick.add', { item: item.label.toLowerCase() })}
            className="flex-row items-center justify-end gap-3 active:opacity-70">
            <Glass radius={18} style={styles.label}>
              <Text className="font-sans-bold text-base text-ink">{item.label}</Text>
            </Glass>
            <Glass radius={BUBBLE_SIZE / 2} interactive style={styles.bubble}>
              <Sticker emoji={item.emoji} fill={item.fill} />
            </Glass>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

// floating bar: three tabs in a glass pill, and the + button beside it.
// Tap + to log spending; hold it to open the quick-add stack.
export function TabBar() {
  const [onBrand, brand] = useCSSVariable(['--color-on-brand', '--color-brand']) as string[];
  const [open, setOpen] = useState(false);

  // the + turns into an × while the stack is open
  const turn = useSharedValue(0);
  useEffect(() => {
    turn.value = withSpring(open ? 1 : 0, {
      damping: 22,
      reduceMotion: ReduceMotion.System,
    });
  }, [open, turn]);
  const plusStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value * 45}deg` }],
  }));

  const openMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    setOpen(true);
  };
  const pick = (href: Href) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      {open ? (
        <Animated.View
          entering={FadeIn.duration(150).reduceMotion(ReduceMotion.System)}
          exiting={FadeOut.duration(150).reduceMotion(ReduceMotion.System)}
          style={styles.backdrop}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}

      <View pointerEvents="box-none" style={styles.bar} className="flex-row items-center gap-3">
        <Glass radius={32} interactive style={styles.pill}>
          <View className="flex-1 flex-row">
            {TABS.map((t) => (
              <TabTrigger key={t.name} name={t.name} asChild>
                <TabButton label={t.label} icon={t.icon} iconSelected={t.iconSelected} />
              </TabTrigger>
            ))}
          </View>
        </Glass>

        <Pressable
          onPress={() => (open ? setOpen(false) : router.push('/add'))}
          // keep onLongPress set for the whole press: if it disappears mid-hold, letting go counts as a tap
          // and the tap closes the stack again
          onLongPress={() => {
            if (!open) openMenu();
          }}
          delayLongPress={HOLD_MS}
          onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
          accessibilityRole="button"
          accessibilityLabel={open ? t('common.close') : t('tab.logSpending')}
          accessibilityHint={open ? undefined : t('tab.holdHint')}
          accessibilityActions={[{ name: 'longpress', label: t('tab.holdAction') }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'longpress') openMenu();
          }}
          className="-rotate-6">
          <Glass radius={PLUS_SIZE / 2} tint={brand} interactive style={styles.plus}>
            <Animated.View style={plusStyle}>
              <SymbolView name="plus" size={30} weight="heavy" tintColor={onBrand} />
            </Animated.View>
          </Glass>
        </Pressable>
      </View>

      {open ? <QuickAdd onPick={pick} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  bar: { position: 'absolute', bottom: BAR_BOTTOM, left: 20, right: 20 },
  pill: { flex: 1, height: 64 },
  plus: {
    width: PLUS_SIZE,
    height: PLUS_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // right-aligned over the + button, starting just above it
  stack: {
    position: 'absolute',
    right: 20 + (PLUS_SIZE - BUBBLE_SIZE) / 2,
    bottom: BAR_BOTTOM + PLUS_SIZE + 16,
    gap: 12,
    alignItems: 'flex-end',
  },
  label: { height: 36, paddingHorizontal: 14, justifyContent: 'center' },
  bubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
