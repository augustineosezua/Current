// App strings in English and Canadian French (ROADMAP 2.6). English is the source of truth: `en.ts` defines every
// key, and `fr.ts` must translate every one of them or type checks fail. No Expo imports, so vitest can load it.
import { en, type MessageKey } from './en';
import { fr } from './fr';

export type { MessageKey } from './en';
export type Language = 'en' | 'fr';

// the phone's language, read once; the app follows it and has no setting of its own
function detectLanguage(): Language {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale;
    return tag.toLowerCase().startsWith('fr') ? 'fr' : 'en';
  } catch {
    return 'en';
  }
}

export const LANGUAGE: Language = detectLanguage();

// dates and money are Canadian in both languages until other currencies arrive (ROADMAP 3.2)
export const LOCALE = LANGUAGE === 'fr' ? 'fr-CA' : 'en-CA';
export const CURRENCY = 'CAD';

const MESSAGES: Record<Language, Record<MessageKey, string>> = { en, fr };

export type Params = Record<string, string | number>;

// fill {name} placeholders from params; a missing param leaves the placeholder visible so it gets noticed
export function format(template: string, params: Params = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

// one string in the app's language
export function t(key: MessageKey, params?: Params, language: Language = LANGUAGE): string {
  return format(MESSAGES[language][key] ?? MESSAGES.en[key] ?? key, params);
}

// "1 day" / "3 days": the `one` key when count is 1, `other` otherwise; {count} is filled in
export function plural(count: number, one: MessageKey, other: MessageKey, params: Params = {}, language: Language = LANGUAGE): string {
  return t(count === 1 ? one : other, { ...params, count }, language);
}
