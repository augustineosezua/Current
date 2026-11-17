import * as Haptics from 'expo-haptics';
import { Link } from 'expo-router';
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ComponentRef, Ref } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Raised } from './raised';

const TABS: { name: string; label: string; icon: SFSymbol; iconSelected: SFSymbol }[] = [
  { name: 'index', label: 'Home', icon: 'house', iconSelected: 'house.fill' },
  { name: 'activity', label: 'Activity', icon: 'list.bullet', iconSelected: 'list.bullet' },
  { name: 'plan', label: 'Plan', icon: 'calendar', iconSelected: 'calendar' },
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
}: TabTriggerSlotProps & { label: string; icon: SFSymbol; iconSelected: SFSymbol }) {
  const [ink, muted] = useCSSVariable(['--color-ink', '--color-muted']) as string[];
  return (
    <Pressable
      {...props}
      // TabTriggerSlotProps types the ref as View's component type; RN 0.88's Pressable wants the element
      ref={ref as unknown as Ref<ComponentRef<typeof Pressable>>}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      className="flex-1 items-center justify-center gap-0.5">
      <SymbolView name={isFocused ? iconSelected : icon} size={22} tintColor={isFocused ? ink : muted} />
      <Text className={`text-[11px] ${isFocused ? 'font-sans-bold text-ink' : 'font-sans-medium text-muted'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

// floating bar: three tabs in a pill, and the + button beside it
export function TabBar() {
  const onBrand = useCSSVariable('--color-on-brand') as string;
  return (
    <View pointerEvents="box-none" className="absolute bottom-7 left-5 right-5 flex-row items-center gap-3">
      <Raised shape="rounded-full" className="h-16 flex-1">
        <View className="flex-1 flex-row">
          {TABS.map((t) => (
            <TabTrigger key={t.name} name={t.name} asChild>
              <TabButton label={t.label} icon={t.icon} iconSelected={t.iconSelected} />
            </TabTrigger>
          ))}
        </View>
      </Raised>
      <Link href="/add" asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log spending"
          onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}>
          <Raised shape="rounded-full" surface="bg-brand" className="h-[72px] w-[72px] -rotate-6">
            <View className="flex-1 items-center justify-center">
              <SymbolView name="plus" size={30} weight="heavy" tintColor={onBrand} />
            </View>
          </Raised>
        </Pressable>
      </Link>
    </View>
  );
}
