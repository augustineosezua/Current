// ROADMAP 2.9: the app's one AI module. On-device first; the cloud proxy only on iPhones that can't run Apple's
// model, only after the one-time disclosure, and only while the "Cloud AI" setting is on.
//
// November 17, 2026: Augustine chose on-device only for now. CLOUD_AI_ENABLED keeps the cloud path switched off,
// so nothing leaves the phone; the proxy (app/api/src/ai) and the disclosure screen stay in the repo, parked.
// Turning it back on also needs the privacy policy's cloud AI section restored (legal/privacy.md). The model never does
// arithmetic: callers give it figures core already computed, or text to parse.
import { buildPrompt, validateAiResult, type AiRequest, type AiResults, type AiTask } from '@current/core';
import { useEffect, useState } from 'react';

import type { Settings } from '@/db/records';
import * as repo from '@/db/repo';
import { useLiveQuery } from '@/hooks/use-live-query';
import { LANGUAGE } from '@/i18n';
import { track } from '@/lib/analytics';

import { cloudConfigured, generateInCloud } from './cloud';
import { generateOnDevice, onDeviceAvailable } from './on-device';

export const CLOUD_AI_ENABLED = false;

export type AiBackend = 'on-device' | 'cloud';

// what AI can do on this phone right now
export type AiAvailability =
  | 'on-device'
  // cloud allowed and already disclosed
  | 'cloud'
  // cloud would work, but the disclosure hasn't been shown yet
  | 'needs-disclosure'
  // the user turned cloud AI off, or there's no backend at all
  | 'off';

type AiSettings = Pick<Settings, 'cloudAi' | 'cloudAiDisclosedAt'>;

// which backend would answer, given the saved settings
export async function getAiAvailability(settings: AiSettings): Promise<AiAvailability> {
  if (await onDeviceAvailable(LANGUAGE)) return 'on-device';
  if (!CLOUD_AI_ENABLED || !settings.cloudAi || !cloudConfigured()) return 'off';
  return settings.cloudAiDisclosedAt ? 'cloud' : 'needs-disclosure';
}

// availability for a screen, following settings changes; null while it's being worked out
export function useAiAvailability(): AiAvailability | null {
  const { data: settings } = useLiveQuery(repo.getSettings);
  const [availability, setAvailability] = useState<AiAvailability | null>(null);
  const cloudAi = settings?.cloudAi;
  const disclosed = settings?.cloudAiDisclosedAt;

  // re-check whenever the two settings that matter change
  useEffect(() => {
    if (cloudAi === undefined) return;
    let active = true;
    getAiAvailability({ cloudAi, cloudAiDisclosedAt: disclosed ?? null })
      .then((a) => active && setAvailability(a))
      .catch(() => active && setAvailability('off'));
    return () => {
      active = false;
    };
  }, [cloudAi, disclosed]);
  return availability;
}

export interface AiAnswer<T extends AiTask> {
  result: AiResults[T];
  backend: AiBackend;
}

// a task's request without a language; the app's own is filled in
export type AiInput<T extends AiTask = AiTask> = Omit<Extract<AiRequest, { task: T }>, 'language'>;

// a function that runs one AI task
export type AiRunner = <T extends AiTask>(input: AiInput<T> & { task: T }) => Promise<AiAnswer<T> | null>;

// run one task on whichever backend is allowed; null when AI is unavailable or the answer didn't fit the schema
export async function runAi<T extends AiTask>(input: AiInput<T> & { task: T }, settings: AiSettings): Promise<AiAnswer<T> | null> {
  const request = { ...input, language: LANGUAGE } as unknown as AiRequest & { task: T };
  const availability = await getAiAvailability(settings);
  if (availability === 'off' || availability === 'needs-disclosure') return null;
  const backend: AiBackend = availability;
  // general chat carries what the user types and the conversation, so it never leaves the phone
  if ((request.task === 'chat' || request.task === 'assistant') && backend !== 'on-device') return null;
  try {
    const raw = backend === 'on-device' ? await generateOnDevice(buildPrompt(request)) : await generateInCloud(request);
    const result = validateAiResult(request.task, raw, request);
    track(result ? 'ai_answered' : 'ai_failed', { task: request.task, backend });
    return result ? { result, backend } : null;
  } catch {
    track('ai_failed', { task: request.task, backend });
    return null;
  }
}
