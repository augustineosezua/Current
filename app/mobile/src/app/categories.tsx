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
import { fillFor, KIND_GROUPS } from '@/lib/categories';

// one category: tap it to edit, the arrows to move it up or down within its group
function CategoryRow({ category, isFirst, isLast }: { category: CategoryRecord; isFirst: boolean; isLast: boolean }) {
  const db = useSQLiteContext();
  return (
    <View className="min-h-16 flex-row items-center gap-1 py-2 pl-4 pr-2">
      <Link href={{ pathname: '/category', params: { id: category.id } }} asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${category.name}. Edit`}
          className="flex-1 flex-row items-center gap-3 active:opacity-70">
          <Sticker emoji={category.emoji} fill={fillFor(category.color)} />
          <Text className="flex-1 font-sans-bold text-base text-ink" numberOfLines={1}>
            {category.name}
          </Text>
        </Pressable>
      </Link>
      <MoveButton direction="up" label={`Move ${category.name} up`} disabled={isFirst} onPress={() => void moveCategory(db, category.id, 'up')} />
      <MoveButton direction="down" label={`Move ${category.name} down`} disabled={isLast} onPress={() => void moveCategory(db, category.id, 'down')} />
    </View>
  );
}

// every category, grouped by what kind of money it is, with a line on what each group means
export default function CategoriesScreen() {
  const { data } = useLiveQuery(repo.categories.list);
  const categories = data ?? [];

  return (
    <Screen header={<BackButton />} title="Categories">
      <Text className="font-sans text-base leading-6 text-muted">
        When you log something, you pick one of these. That&apos;s how Activity shows where your money went. Tap one to rename
        it or change its sticker.
      </Text>

      {KIND_GROUPS.map((group) => {
        const rows = categories.filter((c) => c.kind === group.kind);
        if (rows.length === 0) return null;
        return (
          <View key={group.kind} className="gap-2">
            <View className="gap-0.5 px-1">
              <Text className="font-display-bold text-xl text-ink">{group.title}</Text>
              <Text className="font-sans text-sm leading-5 text-muted">{group.blurb}</Text>
            </View>
            <Raised>
              <View className="py-1">
                {rows.map((c, i) => (
                  <CategoryRow key={c.id} category={c} isFirst={i === 0} isLast={i === rows.length - 1} />
                ))}
              </View>
            </Raised>
          </View>
        );
      })}

      <Text className="text-center font-sans text-sm leading-5 text-muted">
        The arrows change the order they show up in when you&apos;re logging something.
      </Text>
      <Button label="Add a category" onPress={() => router.push('/category')} />
    </Screen>
  );
}
