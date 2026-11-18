import { Pressable, Text, View } from 'react-native';

import type { CategoryRecord } from '@/db/records';
import { t } from '@/i18n';
import { categoryName, fillFor } from '@/lib/categories';

import { Label } from './form';

// single-choice category chips; tapping the chosen one clears it
export function CategoryPicker({
  label = t('common.category'),
  categories,
  value,
  onChange,
}: {
  label?: string;
  categories: readonly CategoryRecord[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  if (categories.length === 0) return null;
  return (
    <View className="gap-2">
      <Label>{label}</Label>
      <View className="flex-row flex-wrap gap-2">
        {categories.map((c) => {
          const selected = c.id === value;
          return (
            <Pressable
              key={c.id}
              onPress={() => onChange(selected ? null : c.id)}
              accessibilityRole="button"
              accessibilityLabel={categoryName(c)}
              accessibilityState={{ selected }}
              className={`min-h-11 flex-row items-center gap-2 rounded-full border-2 px-4 ${selected ? `border-ink ${fillFor(c.color)}` : 'border-transparent bg-field active:opacity-70'}`}>
              <Text className="text-base">{c.emoji}</Text>
              <Text className={`text-base ${selected ? 'font-sans-bold text-on-brand' : 'font-sans-medium text-ink'}`}>{categoryName(c)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
