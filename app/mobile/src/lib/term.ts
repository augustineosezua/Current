// Term-plan wording by storefront. No Expo imports, so vitest can load it.
import type { Storefront } from '@current/core';

import { getStorefront } from './categories';

export interface TermPreset {
  // suggested name for a new plan
  name: string;
  // one line saying what counts as term money here
  hint: string;
}

const PRESETS: Record<Storefront, TermPreset> = {
  CA: { name: 'OSAP', hint: 'OSAP, a scholarship, co-op pay. Money that comes in once and has to last the whole semester.' },
  US: { name: 'Financial aid refund', hint: 'A financial aid refund or a scholarship. Money that comes in once and has to last the whole semester.' },
  GB: { name: 'Maintenance loan', hint: 'A maintenance loan or a bursary. Money that comes in once and has to last the whole term.' },
  OTHER: { name: 'Semester money', hint: 'A loan, grant or scholarship. Money that comes in once and has to last the whole semester.' },
};

// the preset for this phone's region
export function termPreset(storefront: Storefront = getStorefront()): TermPreset {
  return PRESETS[storefront];
}
