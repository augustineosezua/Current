import { Link, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, Text, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { Button } from '@/components/form';
import { MoveButton } from '@/components/move-button';
import { Raised } from '@/components/raised';
import { Screen } from '@/components/screen';
import { Sticker } from '@/components/sticker';
import { moveCategory } from '@/db/categories';
import type { CategoryRecord } from '@/db/records';
import * as repo from '@/db/repo';
import { useLiveQuery } from '@/hooks/use-live-query';
import { fillFor, KIND_LABELS } from '@/lib/categories';

// one category: tap the row to edit, the arrows to change where it sits in the picker
function CategoryRow({ category, isFirst, isLast }: { category: CategoryRecord; isFirst: boolean; isLast: boolean }) {
  const db = useSQLiteContext();
  return (
    <View className="min-h-16 flex-row items-center gap-1 py-2 pl-4 pr-2">
      <Link href={{ pathname: '/category', params: { id: category.id } }} asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${category.name}, ${KIND_LABELS[category.kind]}. Edit`}
          className="flex-1 flex-row items-center gap-3 active:opacity-70">
          <Sticker emoji={category.emoji} fill={fillFor(category.color)} />
          <View className="flex-1">
            <Text className="font-sans-bold text-base text-ink" numberOfLines={1}>
              {category.name}
            </Text>
            <Text className="font-sans text-sm text-muted">{KIND_LABELS[category.kind]}</Text>
          </View>
        </Pressable>
      </Link>
      <MoveButton direction="up" label={`Move ${category.name} up`} disabled={isFirst} onPress={() => void moveCategory(db, category.id, 'up')} />
      <MoveButton direction="down" label={`Move ${category.name} down`} disabled={isLast} onPress={() => void moveCategory(db, category.id, 'down')} />
    </View>
  );
}

// every category, in the order the picker shows them
export default function CategoriesScreen() {
  const { data } = useLiveQuery(repo.categories.list);
  const categories = data ?? [];

  return (
    <Screen header={<BackButton />} title="Categories">
      {categories.length > 0 ? (
        <Raised>
          <View className="py-1">
            {categories.map((c, i) => (
              <CategoryRow key={c.id} category={c} isFirst={i === 0} isLast={i === categories.length - 1} />
            ))}
          </View>
        </Raised>
      ) : null}
      <Button label="Add a category" onPress={() => router.push('/category')} />
    </Screen>
  );
}
