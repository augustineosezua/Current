import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';

const StyledSafeAreaView = withUniwind(SafeAreaView);

// page shell: dark background, safe-area top, titled scroll column on the 8pt grid
export function Screen({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <StyledSafeAreaView edges={['top']} className="flex-1 bg-ink">
      <ScrollView contentContainerClassName="gap-6 px-4 pb-24 pt-4">
        {title ? <Text className="font-sans-extrabold text-3xl text-white">{title}</Text> : null}
        {children}
      </ScrollView>
    </StyledSafeAreaView>
  );
}

// kind empty state with exactly one next step (DESIGN.MD)
export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View className="gap-2 rounded-md bg-surface p-6">
      <Text className="font-sans-bold text-lg text-white">{title}</Text>
      <Text className="font-sans text-base text-white/70">{body}</Text>
    </View>
  );
}
