import { getAppIconName, setAlternateAppIcon, supportsAlternateIcons } from 'expo-alternate-app-icons';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { PlusTeaser } from '@/components/plus';
import { Raised } from '@/components/raised';
import { Screen } from '@/components/screen';
import { saveSetting } from '@/db/plan';
import * as repo from '@/db/repo';
import { useLiveQuery } from '@/hooks/use-live-query';
import { t, type MessageKey } from '@/i18n';
import { usePlus } from '@/lib/plus';
import { applyTheme, ICONS, THEME_IDS, THEMES, type IconName } from '@/lib/themes';

// a swatch of a theme in light (left) and dark (right): page, a card with a line of text and its button colour
function ThemeSwatch({ id, selected, onPress }: { id: (typeof THEME_IDS)[number]; selected: boolean; onPress: () => void }) {
  const paper = THEMES[id].light;
  const dark = THEMES[id].dark;
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={t(`theme.${id}` as MessageKey)} className="w-[30%] items-center gap-1.5">
      <View className={`h-20 w-full flex-row overflow-hidden rounded-md border-2 ${selected ? 'border-ink' : 'border-field'}`}>
        <View style={{ backgroundColor: paper.bg }} className="flex-1 items-center justify-center">
          <View style={{ backgroundColor: paper.card }} className="h-8 w-10 items-start justify-end gap-1 rounded-sm p-1.5">
            <View style={{ backgroundColor: paper.muted }} className="h-1 w-5 rounded-full" />
            <View style={{ backgroundColor: paper.cta }} className="h-2 w-7 rounded-full" />
          </View>
        </View>
        <View style={{ backgroundColor: dark.bg }} className="flex-1 items-center justify-center">
          <View style={{ backgroundColor: dark.card }} className="h-8 w-10 items-start justify-end gap-1 rounded-sm p-1.5">
            <View style={{ backgroundColor: dark.muted }} className="h-1 w-5 rounded-full" />
            <View style={{ backgroundColor: dark.cta }} className="h-2 w-7 rounded-full" />
          </View>
        </View>
      </View>
      <Text className={`font-sans-medium text-sm ${selected ? 'text-ink' : 'text-muted'}`}>{t(`theme.${id}` as MessageKey)}</Text>
    </Pressable>
  );
}

// 2.11 (Plus): colour themes and alternate app icons, cosmetic only
export default function AppearanceScreen() {
  const db = useSQLiteContext();
  const isPlus = usePlus();
  const { data: settings } = useLiveQuery(repo.getSettings);
  const [icon, setIcon] = useState<IconName>(() => {
    try {
      return (getAppIconName() as IconName) ?? null;
    } catch {
      return null;
    }
  });

  if (!isPlus) {
    return (
      <Screen header={<BackButton />} title={t('appearance.title')}>
        <PlusTeaser title={t('appearance.title')} body={t('plus.f.themes')} from="appearance" />
      </Screen>
    );
  }

  const pickIcon = async (name: IconName) => {
    try {
      await setAlternateAppIcon(name);
      setIcon(name);
      Haptics.selectionAsync();
    } catch {
      // iOS refused (e.g. mid-transition); leave the current icon
    }
  };

  return (
    <Screen header={<BackButton />} title={t('appearance.title')}>
      <Text className="font-display-bold text-xl text-ink">{t('appearance.theme')}</Text>
      <Raised>
        <View accessibilityRole="radiogroup" className="flex-row flex-wrap justify-between gap-y-4 p-5">
          {THEME_IDS.map((id) => (
            <ThemeSwatch
              key={id}
              id={id}
              selected={(settings?.theme ?? 'default') === id}
              onPress={() => {
                Haptics.selectionAsync();
                // repaint now; the saved setting keeps it on the next launch
                applyTheme(id, true);
                void saveSetting(db, 'theme', id);
              }}
            />
          ))}
        </View>
      </Raised>

      <Text className="font-display-bold text-xl text-ink">{t('appearance.icon')}</Text>
      {supportsAlternateIcons ? (
        <>
          <Raised>
            <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2 p-5">
              {ICONS.map((name) => {
                const selected = icon === name;
                return (
                  <Pressable
                    key={name ?? 'default'}
                    onPress={() => void pickIcon(name)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    className={`min-h-11 justify-center rounded-full px-4 ${selected ? 'bg-cta' : 'bg-field active:opacity-70'}`}>
                    <Text className={`text-base ${selected ? 'font-sans-bold text-on-cta' : 'font-sans-medium text-ink'}`}>
                      {t(`icon.${name ?? 'default'}` as MessageKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Raised>
          <Text className="text-center font-sans text-sm text-muted">{t('appearance.iconNote')}</Text>
        </>
      ) : (
        <Text className="font-sans text-base text-muted">{t('appearance.iconsUnsupported')}</Text>
      )}
    </Screen>
  );
}
