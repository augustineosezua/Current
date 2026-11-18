import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { runAi, useAiAvailability, type AiAvailability, type AiRunner } from '@/ai';
import * as repo from '@/db/repo';

// AI for a screen: what's available, and a runner that shows the cloud disclosure first when it's needed
export function useAi(): {
  availability: AiAvailability | null;
  // false when AI can't answer here (off, or the disclosure is showing instead)
  ready: boolean;
  run: AiRunner;
} {
  const db = useSQLiteContext();
  const availability = useAiAvailability();

  const run: AiRunner = async (input) => {
    if (availability === 'needs-disclosure') {
      router.push('/cloud-ai');
      return null;
    }
    if (availability !== 'on-device' && availability !== 'cloud') return null;
    return runAi(input as never, await repo.getSettings(db));
  };

  return { availability, ready: availability === 'on-device' || availability === 'cloud', run };
}
