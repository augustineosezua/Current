import { CATEGORY_COLORS, type CategoryColor, type CategoryKind } from '@current/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Chips, Field, Label, Sheet } from '@/components/form';
import { Sticker } from '@/components/sticker';
import { createCategory, deleteCategory, updateCategory } from '@/db/categories';
import type { CategoryRecord } from '@/db/records';
import * as repo from '@/db/repo';
import { useLiveQuery } from '@/hooks/use-live-query';
import { CATEGORY_EMOJI, CATEGORY_FILLS, fillFor, KIND_GROUPS, lastEmoji } from '@/lib/categories';

const KINDS: readonly { value: CategoryKind; label: string }[] = KIND_GROUPS.map((g) => ({ value: g.kind, label: g.title }));

// add or edit a category: name, sticker and what kind of money it is
function CategoryForm({ category }: { category: CategoryRecord | null }) {
  const db = useSQLiteContext();
  const [name, setName] = useState(category?.name ?? '');
  const [emoji, setEmoji] = useState<string>(category?.emoji ?? CATEGORY_EMOJI[0]);
  const [color, setColor] = useState<CategoryColor>(
    category && category.color in CATEGORY_FILLS ? (category.color as CategoryColor) : 'peach',
  );
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? 'wants');
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length > 0;
  // a typed sticker joins the front of the grid, so it stays visible and editing never loses it
  const isCustom = !(CATEGORY_EMOJI as readonly string[]).includes(emoji);
  const emojiChoices = isCustom ? [emoji, ...CATEGORY_EMOJI] : CATEGORY_EMOJI;

  // keep only the newest emoji typed; letters and digits are ignored
  const typeEmoji = (text: string) => {
    const typed = lastEmoji(text);
    if (typed) setEmoji(typed);
  };

  // run a write, close the sheet, and surface a failure instead of losing it
  const run = async (task: () => Promise<unknown>) => {
    try {
      await task();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // create or update
  const save = () =>
    run(async () => {
      if (!valid) return;
      const input = { name: name.trim(), emoji, color, kind };
      if (category) await updateCategory(db, category.id, input);
      else await createCategory(db, input);
    });

  return (
    <Sheet title={category ? 'Edit category' : 'New category'}>
      <View className="items-center">
        <Sticker emoji={emoji} fill={fillFor(color)} size="lg" tilt={-1} />
      </View>
      <Field label="Name" value={name} onChangeText={setName} placeholder="Takeout" autoFocus={!category} />

      <View className="gap-2">
        <Label>Sticker</Label>
        <View className="flex-row flex-wrap gap-2">
          {emojiChoices.map((e) => (
            <Pressable
              key={e}
              onPress={() => setEmoji(e)}
              accessibilityRole="button"
              accessibilityLabel={e}
              accessibilityState={{ selected: e === emoji }}
              className={`h-11 w-11 items-center justify-center rounded-sm border-2 ${e === emoji ? 'border-ink bg-card' : 'border-transparent bg-field'}`}>
              <Text className="text-xl">{e}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Field label="Or type your own" value={isCustom ? emoji : ''} onChangeText={typeEmoji} placeholder="Tap here, then use the emoji keyboard" />

      <View className="gap-2">
        <Label>Colour</Label>
        <View className="flex-row flex-wrap gap-2">
          {CATEGORY_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              accessibilityRole="button"
              accessibilityLabel={c}
              accessibilityState={{ selected: c === color }}
              className={`h-11 w-11 rounded-full border-2 ${CATEGORY_FILLS[c]} ${c === color ? 'border-ink' : 'border-transparent'}`}
            />
          ))}
        </View>
      </View>

      <Chips label="What kind is it?" options={KINDS} value={kind} onChange={setKind} />
      <Text className="font-sans text-base leading-6 text-muted">{KIND_GROUPS.find((g) => g.kind === kind)?.blurb}</Text>

      {error ? <Text className="font-sans-medium text-base text-ink">That didn&apos;t save: {error}</Text> : null}
      <Button label="Save" onPress={save} disabled={!valid} />
      {category ? (
        <>
          <Text className="text-center font-sans text-sm text-muted">Anything you&apos;ve already logged stays. It just shows up as uncategorized.</Text>
          <Button label="Delete category" kind="plain" onPress={() => run(() => deleteCategory(db, category.id))} />
        </>
      ) : null}
    </Sheet>
  );
}

// add-category sheet, or edit with ?id=
export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const load = useCallback(async (db: SQLiteDatabase) => ({ category: id ? await repo.categories.get(db, id) : null }), [id]);
  const { data } = useLiveQuery(load, false);

  if (!data) return <Sheet title="">{null}</Sheet>;
  return <CategoryForm category={data.category} />;
}
