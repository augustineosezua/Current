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
  CA: { name: 'OSAP', hint: 'OSAP, a scholarship or co-op pay: money that lands once and has to last the term.' },
  US: { name: 'Financial aid refund', hint: 'A financial aid refund or a scholarship: money that lands once and has to last the term.' },
  GB: { name: 'Maintenance loan', hint: 'A maintenance loan or a bursary: money that lands once and has to last the term.' },
  OTHER: { name: 'Term money', hint: 'A loan, grant or scholarship: money that lands once and has to last the term.' },
};

// the preset for this phone's region
export function termPreset(storefront: Storefront = getStorefront()): TermPreset {
  return PRESETS[storefront];
}
