import { addDays, isSameDay, startOfMonth } from '@current/core';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { dayLabel, monthLabel } from '@/lib/format';

import { Label } from './form';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// the 42 days shown for a month, starting on the Sunday on or before the 1st
function monthGrid(month: Date): Date[] {
  const first = startOfMonth(month);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

// previous / next month arrow
function MonthArrow({ icon, label, onPress }: { icon: 'chevron.left' | 'chevron.right'; label: string; onPress: () => void }) {
  const ink = useCSSVariable('--color-ink') as string;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} className="h-11 w-11 items-center justify-center">
      <SymbolView name={icon} size={16} weight="semibold" tintColor={ink} />
    </Pressable>
  );
}

// a date row that opens a month calendar drawn in code (no native picker to configure)
export function DateField({
  label,
  value,
  onChange,
  defaultOpen = false,
}: {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [month, setMonth] = useState(() => startOfMonth(value ?? new Date()));
  const today = new Date();

  return (
    <View className="gap-2">
      <Label>{label}</Label>
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? dayLabel(value) : 'not set'}`}
        className="min-h-13 justify-center rounded-sm bg-field px-4">
        <Text className={`font-sans-medium text-lg ${value ? 'text-ink' : 'text-muted'}`}>
          {value ? dayLabel(value) : 'Pick a date'}
        </Text>
      </Pressable>

      {open ? (
        <View className="rounded-md border-2 border-edge bg-card p-3">
          <View className="flex-row items-center justify-between">
            <MonthArrow icon="chevron.left" label="Previous month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} />
            <Text className="font-display-bold text-lg text-ink">{monthLabel(month)}</Text>
            <MonthArrow icon="chevron.right" label="Next month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
          </View>

          <View className="flex-row">
            {WEEKDAYS.map((d, i) => (
              <Text key={i} className="flex-1 text-center font-sans-bold text-xs text-muted">
                {d}
              </Text>
            ))}
          </View>

          <View className="flex-row flex-wrap">
            {monthGrid(month).map((day) => {
              const selected = !!value && isSameDay(day, value);
              const inMonth = day.getMonth() === month.getMonth();
              const isToday = isSameDay(day, today);
              return (
                <Pressable
                  key={day.getTime()}
                  onPress={() => {
                    onChange(day);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={dayLabel(day)}
                  accessibilityState={{ selected }}
                  className="h-11 w-[14.28%] items-center justify-center">
                  <View className={`h-9 w-9 items-center justify-center rounded-full ${selected ? 'bg-cta' : isToday ? 'bg-field' : ''}`}>
                    <Text
                      className={`text-base tabular-nums ${selected ? 'font-sans-bold text-on-cta' : inMonth ? 'font-sans-medium text-ink' : 'font-sans text-muted'}`}>
                      {day.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}
