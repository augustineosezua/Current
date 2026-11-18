// Anonymous product events. A no-op until ROADMAP G.1 picks a provider; call sites are in place so wiring it up
// is one file. Never pass amounts, merchant names, notes, account names or AI text: only the names below and
// small enum-like properties.
export type AnalyticsEvent =
  | 'paywall_shown'
  | 'trial_started'
  | 'purchase'
  | 'ai_answered'
  | 'ai_failed'
  | 'quick_add'
  | 'import_done';

export type AnalyticsProps = Record<string, string | number | boolean>;

// record one event; safe to call anywhere, never throws
export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  void event;
  void props;
}
