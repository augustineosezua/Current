import { describe, expect, it } from 'vitest';

import { en, type MessageKey } from './en';
import { fr } from './fr';
import { format, plural, t } from './index';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('2.6 French', () => {
  it('translates every key, keeping the same placeholders', () => {
    for (const key of Object.keys(en) as MessageKey[]) {
      expect(fr[key], key).toBeTruthy();
      expect(placeholders(fr[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it('fills placeholders and leaves unknown ones visible', () => {
    expect(format('Hi {name}, {missing}', { name: 'Sam' })).toBe('Hi Sam, {missing}');
    expect(t('home.staleBalance', { days: 9 }, 'fr')).toBe("Tu n'as pas vérifié ton solde depuis 9 jours");
  });

  it('picks the singular or plural key', () => {
    expect(plural(1, 'import.foundOne', 'import.found', { from: 'Jan 2', to: 'Jan 3' }, 'en')).toBe('Found 1 entry on Jan 2.');
  });
});
