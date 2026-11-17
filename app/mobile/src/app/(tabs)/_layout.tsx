import { TabList, TabSlot, Tabs, TabTrigger } from 'expo-router/ui';
import { View } from 'react-native';

import { TabBar } from '@/components/tab-bar';

// three tabs; the visible bar is drawn by TabBar, this hidden list only registers the routes
export default function TabsLayout() {
  return (
    <Tabs>
      <TabSlot />
      <View className="hidden">
        <TabList>
          <TabTrigger name="index" href="/" />
          <TabTrigger name="activity" href="/activity" />
          <TabTrigger name="plan" href="/plan" />
        </TabList>
      </View>
      <TabBar />
    </Tabs>
  );
}
