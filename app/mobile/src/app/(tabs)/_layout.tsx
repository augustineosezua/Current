import { TabList, TabSlot, Tabs, TabTrigger } from 'expo-router/ui';

import { TabBar } from '@/components/tab-bar';

// three tabs; the visible bar is drawn by TabBar, this hidden list only registers the routes.
// TabList must be a direct child of Tabs: expo-router only reads triggers from Tabs' own children
// (and fragments), so wrapping it in a View leaves no tabs registered and the bar's taps do nothing.
export default function TabsLayout() {
  return (
    <Tabs>
      <TabSlot />
      <TabList style={{ display: 'none' }}>
        <TabTrigger name="index" href="/" />
        <TabTrigger name="activity" href="/activity" />
        <TabTrigger name="plan" href="/plan" />
      </TabList>
      <TabBar />
    </Tabs>
  );
}
