import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';

import { Pop, usePressScale } from './motion';
import { Raised } from './raised';

// round × in a sheet's top right corner; closes without saving
function CloseButton() {
  const ink = useCSSVariable('--color-ink') as string;
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={8}
      className="h-11 w-11 items-center justify-center rounded-full bg-field active:opacity-70">
      <SymbolView name="xmark" size={16} weight="bold" tintColor={ink} />
    </Pressable>
  );
}

// body of a form sheet: title, then fields in a scroll column that keeps taps working over the keyboard
export function Sheet({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="gap-5 px-5 pb-12 pt-8"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive">
      <View className="flex-row items-start justify-between gap-3">
        <Text className="flex-1 font-display text-3xl text-ink">{title}</Text>
        <CloseButton />
      </View>
      {children}
    </ScrollView>
  );
}

// literal classes per kind so Tailwind can see them
const BUTTON_TEXT = {
  primary: 'font-sans-bold text-on-cta',
  secondary: 'font-sans-bold text-ink',
  plain: 'font-sans-medium text-muted',
} as const;

// primary is the raised dark pill; secondary is a flat pill; plain is text only (Skip, Delete)
export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  kind?: keyof typeof BUTTON_TEXT;
  disabled?: boolean;
}) {
  const text = <Text className={`text-center text-base ${BUTTON_TEXT[kind]}`}>{label}</Text>;
  const squish = usePressScale(kind === 'plain' ? 1 : 0.97);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={squish.pressIn}
      onPressOut={squish.pressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={disabled ? 'opacity-40' : kind === 'primary' ? '' : 'active:opacity-70'}>
      {({ pressed }) => (
        <Animated.View style={squish.style}>
          {kind === 'primary' ? (
            <Raised shape="rounded-full" surface="bg-cta" pressed={pressed}>
              <View className="min-h-13 justify-center px-6 py-3">{text}</View>
            </Raised>
          ) : kind === 'secondary' ? (
            <View className="min-h-13 justify-center rounded-full bg-field px-6 py-3">{text}</View>
          ) : (
            <View className="min-h-11 justify-center px-6">{text}</View>
          )}
        </Animated.View>
      )}
    </Pressable>
  );
}

// small caption above a field
export function Label({ children }: { children: string }) {
  return <Text className="font-sans-bold text-sm text-muted">{children}</Text>;
}

// labelled one-line text input
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const muted = useCSSVariable('--color-muted') as string;
  return (
    <View className="gap-2">
      <Label>{label}</Label>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={muted}
        autoFocus={autoFocus}
        autoCapitalize="words"
        returnKeyType="done"
        accessibilityLabel={label}
        className="min-h-13 rounded-sm bg-field px-4 font-sans-medium text-lg text-ink"
      />
    </View>
  );
}

// big money input; the text is parsed with core's toCents by the caller
export function AmountField({
  label,
  value,
  onChangeText,
  autoFocus,
  allowNegative = false,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  autoFocus?: boolean;
  allowNegative?: boolean;
}) {
  const muted = useCSSVariable('--color-muted') as string;
  return (
    <View className="gap-2">
      <Label>{label}</Label>
      <View className="flex-row items-center gap-1 rounded-sm bg-field px-4">
        <Text className="font-display-bold text-3xl text-muted">$</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="0.00"
          placeholderTextColor={muted}
          autoFocus={autoFocus}
          keyboardType={allowNegative ? 'numbers-and-punctuation' : 'decimal-pad'}
          accessibilityLabel={label}
          className="min-h-16 flex-1 font-display text-4xl tabular-nums text-ink"
        />
      </View>
    </View>
  );
}

// single-choice chips that wrap
export function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <View className="gap-2">
      {label ? <Label>{label}</Label> : null}
      <View className="flex-row flex-wrap gap-2">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pop key={o.value} trigger={selected} enabled={selected} to={1.08}>
              <Pressable
                onPress={() => onChange(o.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={`min-h-11 justify-center rounded-full px-4 ${selected ? 'bg-cta' : 'bg-field active:opacity-70'}`}>
                <Text className={`text-base ${selected ? 'font-sans-bold text-on-cta' : 'font-sans-medium text-ink'}`}>{o.label}</Text>
              </Pressable>
            </Pop>
          );
        })}
      </View>
    </View>
  );
}
