import '@/global.css';

import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { NativeTabs } from 'expo-router/native-tabs';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect } from 'react';
import { useCSSVariable } from 'uniwind';

import { migrateDbIfNeeded } from '@/db/migrate';

SplashScreen.preventAutoHideAsync();

// app root: fonts, local database, bottom tabs
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const [ink, accent] = useCSSVariable(['--color-ink', '--color-accent']) as string[];

  // keep the splash up until fonts are ready (or failed, falling back to the system font)
  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SQLiteProvider databaseName="current.db" onInit={migrateDbIfNeeded}>
      <NativeTabs backgroundColor={ink} tintColor={accent}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="transactions">
          <NativeTabs.Trigger.Label>Activity</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="list.bullet" md="list" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="bills">
          <NativeTabs.Trigger.Label>Bills</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'calendar', selected: 'calendar' }} md="calendar_month" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="goals">
          <NativeTabs.Trigger.Label>Goals</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'star', selected: 'star.fill' }} md="star" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} md="settings" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </SQLiteProvider>
  );
}
