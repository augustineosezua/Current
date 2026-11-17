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

import { ReminderSync } from '@/components/reminder-sync';
import { ToastProvider } from '@/components/toast';
import { migrateDbIfNeeded } from '@/db/migrate';

SplashScreen.preventAutoHideAsync();

// app root: fonts, local database, tabs with the form sheets, settings and first-run setup on top
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
      <ReminderSync />
      <ToastProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="add" options={{ presentation: 'formSheet', sheetGrabberVisible: true }} />
          <Stack.Screen name="bill" options={{ presentation: 'formSheet', sheetGrabberVisible: true }} />
          <Stack.Screen name="account" options={{ presentation: 'formSheet', sheetGrabberVisible: true }} />
          <Stack.Screen name="check-in" options={{ presentation: 'formSheet', sheetGrabberVisible: true }} />
          <Stack.Screen name="income" options={{ presentation: 'formSheet', sheetGrabberVisible: true }} />
          <Stack.Screen name="term-plan" options={{ presentation: 'formSheet', sheetGrabberVisible: true }} />
          <Stack.Screen name="goal" options={{ presentation: 'formSheet', sheetGrabberVisible: true }} />
          <Stack.Screen name="category" options={{ presentation: 'formSheet', sheetGrabberVisible: true }} />
          <Stack.Screen name="settings" />
          <Stack.Screen name="categories" />
          <Stack.Screen name="budget" />
          <Stack.Screen name="reminders" />
          <Stack.Screen name="accounts" />
        </Stack>
      </ToastProvider>
    </SQLiteProvider>
  );
}
