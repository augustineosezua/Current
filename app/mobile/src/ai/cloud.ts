// Cloud fallback backend: the stateless proxy in app/api (POST /ai/parse, /ai/explain, /ai/ask, /ai/recap).
// It sends only the request built by core (the question and the figures needed to answer it), never history.
import type { AiRequest } from '@current/core';

import { getInstallId } from '@/lib/plus';

const BASE_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL;
const TIMEOUT_MS = 15_000;

// general chat and the assistant loop are on-device only (runAi never sends it here); the path is listed only to keep the map complete
const PATHS: Record<AiRequest['task'], string> = { parse: 'parse', explain: 'explain', route: 'ask', answer: 'ask', recap: 'recap', chat: 'ask', assistant: 'ask' };

// whether this build knows where the proxy is
export function cloudConfigured(): boolean {
  return !!BASE_URL;
}

// send one request to the proxy; returns its parsed result, or throws
export async function generateInCloud(request: AiRequest): Promise<unknown> {
  if (!BASE_URL) throw new Error('cloud AI is not configured');
  const installId = await getInstallId();
  if (!installId) throw new Error('no install id');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL.replace(/\/$/, '')}/ai/${PATHS[request.task]}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-User-Id': installId },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`proxy returned ${res.status}`);
    return ((await res.json()) as { result: unknown }).result;
  } finally {
    clearTimeout(timer);
  }
}
