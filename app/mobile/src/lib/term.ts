// Term-plan wording by storefront. No Expo imports, so vitest can load it.
import type { Storefront } from '@current/core';

import { t } from '../i18n';
import { getStorefront } from './categories';

export interface TermPreset {
  // suggested name for a new plan
  name: string;
  // one line saying what counts as term money here
  hint: string;
}

// the preset for this phone's region, in the app's language
export function termPreset(storefront: Storefront = getStorefront()): TermPreset {
  return { name: t(`term.name.${storefront}`), hint: t(`term.hint.${storefront}`) };
}
