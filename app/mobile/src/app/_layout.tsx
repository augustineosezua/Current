import '@/global.css';

import { Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import { Nunito_500Medium, Nunito_600SemiBold, Nunito_800ExtraBold, useFonts } from '@expo-google-fonts/nunito';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect } from 'react';
import { useCSSVariable } from 'uniwind';

import { ForegroundRefresh } from '@/components/foreground-refresh';
import { PlusSync } from '@/components/plus-sync';
import { ReminderSync } from '@/components/reminder-sync';
import { ToastProvider } from '@/components/toast';
import { migrateDbIfNeeded } from '@/db/migrate';

SplashScreen.preventAutoHideAsync();

// app root: fonts, local database, tabs with the form sheets, settings and first-run setup on top
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_800ExtraBold,
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
      <PlusSync />
      <ForegroundRefresh />
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
          <Stack.Screen name="plus" options={{ presentation: 'formSheet', sheetGrabberVisible: true }} />
          <Stack.Screen name="cloud-ai" options={{ presentation: 'formSheet', sheetGrabberVisible: true }} />
          <Stack.Screen name="afford" options={{ presentation: 'formSheet', sheetGrabberVisible: true }} />
          <Stack.Screen name="category-budget" options={{ presentation: 'formSheet', sheetGrabberVisible: true }} />
          <Stack.Screen name="import" options={{ presentation: 'formSheet', sheetGrabberVisible: true }} />
          <Stack.Screen name="insights" />
          <Stack.Screen name="recap" />
          <Stack.Screen name="ask" />
          <Stack.Screen name="appearance" />
          <Stack.Screen name="ai-eval" />
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
