// On-device backend: Apple's Foundation Models through Callstack's @react-native-ai/apple (iOS 26+, Apple
// Intelligence on). Only this file knows about the package, so it can be swapped for another wrapper.
import type { AiLanguage, BuiltPrompt } from '@current/core';
import { Platform } from 'react-native';

// the package's provider, loaded lazily so builds without the native module (Expo Go, old iOS) don't crash on import
type AppleProvider = typeof import('@react-native-ai/apple').apple;
let provider: AppleProvider | null | undefined;

async function load(): Promise<AppleProvider | null> {
  if (provider !== undefined) return provider;
  try {
    provider = Platform.OS === 'ios' ? (await import('@react-native-ai/apple')).apple : null;
  } catch {
    provider = null;
  }
  return provider;
}

const cache = new Map<AiLanguage, boolean>();

// whether the on-device model is ready to answer in this language right now
export async function onDeviceAvailable(language: AiLanguage): Promise<boolean> {
  const known = cache.get(language);
  if (known !== undefined) return known;
  const apple = await load();
  let ok = false;
  try {
    const info = apple ? await apple.getModelInfo({ locale: language === 'fr' ? 'fr-CA' : 'en-US' }) : null;
    ok = info?.availability === 'available' && info.supportsLocale;
  } catch {
    ok = false;
  }
  // "model not ready" can change while the app runs, so only remember a yes
  if (ok) cache.set(language, true);
  return ok;
}

// run one prompt with structured output; returns the parsed JSON, or throws
export async function generateOnDevice(prompt: BuiltPrompt): Promise<unknown> {
  const apple = await load();
  if (!apple) throw new Error('on-device model unavailable');
  const model = apple.languageModel();
  // the AI SDK's language model call, used directly so the app doesn't need the whole `ai` package
  const result = await model.doGenerate({
    prompt: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: [{ type: 'text', text: prompt.user }] },
    ],
    responseFormat: { type: 'json', schema: prompt.schema as never },
    maxOutputTokens: prompt.maxTokens,
  } as never);
  const text = (result.content as { type: string; text?: string }[]).find((c) => c.type === 'text')?.text;
  if (!text) throw new Error('on-device model gave no answer');
  return JSON.parse(text);
}
