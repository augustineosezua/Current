import '@/global.css';

import {
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold, useFonts } from '@expo-google-fonts/dm-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect } from 'react';
import { useCSSVariable } from 'uniwind';

import { migrateDbIfNeeded } from '@/db/migrate';

SplashScreen.preventAutoHideAsync();

// app root: fonts, local database, tabs with the add sheet and settings on top
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });
  const bg = useCSSVariable('--color-bg') as string;

  // keep the splash up until fonts are ready (or failed, falling back to the system font)
  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SQLiteProvider databaseName="current.db" onInit={migrateDbIfNeeded}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add" options={{ presentation: 'formSheet', sheetGrabberVisible: true }} />
        <Stack.Screen name="settings" />
      </Stack>
    </SQLiteProvider>
  );
}
