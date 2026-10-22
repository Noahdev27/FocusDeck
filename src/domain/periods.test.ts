import { describe, expect, it } from 'vitest';
import { customPeriod, periodFor, periodLabel, shiftPeriod } from './periods';
import { MAX_RANGE_DAYS } from './stats';

describe('périodes de rapport (EF-R02)', () => {
  it('jour, semaine (lundi → dimanche) et mois contenant un jour', () => {
    expect(periodFor('day', '2026-10-22')).toEqual({ kind: 'day', from: '2026-10-22', to: '2026-10-22' });
    expect(periodFor('week', '2026-10-22')).toEqual({ kind: 'week', from: '2026-10-19', to: '2026-10-25' });
    expect(periodFor('month', '2026-02-14')).toEqual({ kind: 'month', from: '2026-02-01', to: '2026-02-28' });
  });

  it('navigue vers la période précédente ou suivante', () => {
    expect(shiftPeriod(periodFor('day', '2026-03-01'), -1).from).toBe('2026-02-28');
    expect(shiftPeriod(periodFor('week', '2026-10-22'), 1)).toMatchObject({ from: '2026-10-26', to: '2026-11-01' });
    expect(shiftPeriod(periodFor('month', '2026-01-31'), -1)).toMatchObject({ from: '2025-12-01', to: '2025-12-31' });
    expect(shiftPeriod(periodFor('month', '2026-12-15'), 1)).toMatchObject({ from: '2027-01-01', to: '2027-01-31' });
    // Plage libre de 3 jours : glisse de 3 jours, changement d'heure compris.
    expect(shiftPeriod(customPeriod('2026-10-24', '2026-10-26'), 1)).toEqual({ kind: 'custom', from: '2026-10-27', to: '2026-10-29' });
  });

  it('plage libre : bornes remises dans l’ordre et durée plafonnée', () => {
    expect(customPeriod('2026-10-20', '2026-10-01')).toEqual({ kind: 'custom', from: '2026-10-01', to: '2026-10-20' });
    const huge = customPeriod('2000-01-01', '2099-01-01');
    expect(huge.from).toBe('2000-01-01');
    expect(huge.to < '2099-01-01').toBe(true);
    expect(MAX_RANGE_DAYS).toBeGreaterThan(366);
  });

  it('libellés', () => {
    expect(periodLabel(periodFor('day', '2026-10-22'))).toBe('jeudi 22 octobre 2026');
    expect(periodLabel(periodFor('month', '2026-10-22'))).toBe('octobre 2026');
    expect(periodLabel(periodFor('week', '2026-10-22'))).toBe('lun. 19 oct. – dim. 25 oct.');
  });
});
