// Anonymous product events (ROADMAP G.1) sent to PostHog. Events are tied to PostHog's random install ID only:
// no identify(), no person profiles, no screen or touch autocapture, no session replay, no IP geolocation.
// Never pass amounts, merchant names, notes, account names or AI text: only the names below and small
// enum-like properties. A no-op when EXPO_PUBLIC_POSTHOG_KEY is unset, and in development builds unless
// EXPO_PUBLIC_ANALYTICS_IN_DEV=1, so test taps don't pollute the numbers.
import type PostHog from 'posthog-react-native';

import { getStorefront } from './categories';

export type AnalyticsEvent =
  // funnel (G.1); install, opens and weekly active come from PostHog's app lifecycle events
  | 'onboarding_done'
  | 'first_balance'
  | 'first_transaction'
  | 'first_bill'
  | 'first_term_plan'
  | 'activated'
  // Plus
  | 'paywall_shown'
  | 'trial_started'
  | 'purchase'
  // features
  | 'ai_answered'
  | 'ai_failed'
  | 'quick_add'
  | 'import_done';

// events that only count the first time on this install
export type OnceEvent = 'first_balance' | 'first_transaction' | 'first_bill' | 'first_term_plan' | 'activated';

export type AnalyticsProps = Record<string, string | number | boolean>;

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
const ENABLED = !!KEY && (!__DEV__ || process.env.EXPO_PUBLIC_ANALYTICS_IN_DEV === '1');
const ONCE_PREFIX = 'analytics.once.';

let client: PostHog | null = null;

// created on first use; required lazily so tests and keyless builds never load the SDK
function getClient(): PostHog | null {
  if (!ENABLED) return null;
  if (client) return client;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PostHog: PostHogClient } = require('posthog-react-native') as typeof import('posthog-react-native');
    client = new PostHogClient(KEY!, {
      host: HOST,
      personProfiles: 'never',
      captureAppLifecycleEvents: true,
      enableSessionReplay: false,
      disableGeoip: true,
      preloadFeatureFlags: false,
      disableSurveys: true,
    });
    // the phone's locale region stands in for the App Store storefront; PostHog's own IP lookup is off
    void client.register({ storefront: getStorefront(), $geoip_disable: true });
  } catch {
    client = null;
  }
  return client;
}

// record one event; safe to call anywhere, never throws
export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  try {
    getClient()?.capture(event, props);
  } catch {
    // analytics must never break the app
  }
}

// record an event only the first time it happens on this install
export function trackOnce(event: OnceEvent, props: AnalyticsProps = {}): void {
  if (!ENABLED) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Storage = (require('expo-sqlite/kv-store') as typeof import('expo-sqlite/kv-store')).default;
    if (Storage.getItemSync(ONCE_PREFIX + event)) return;
    Storage.setItemSync(ONCE_PREFIX + event, new Date().toISOString());
    track(event, props);
  } catch {
    // analytics must never break the app
  }
}

// start the client at launch so app lifecycle events (installed, opened) are captured
export function initAnalytics(): void {
  getClient();
}
