import { describe, expect, it } from 'vitest';
import { formatClock, formatDuration, fromDateKey, shiftDateKey, toDateKey } from './format';

describe('format', () => {
  it('formatClock arrondit à la seconde supérieure', () => {
    expect(formatClock(25 * 60_000)).toBe('25:00');
    expect(formatClock(59_001)).toBe('01:00');
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(-500)).toBe('00:00');
    expect(formatClock(3_725_000)).toBe('1:02:05');
  });

  it('formatDuration produit un libellé lisible', () => {
    expect(formatDuration(42)).toBe('42 s');
    expect(formatDuration(25 * 60)).toBe('25 min');
    expect(formatDuration(3900)).toBe('1 h 05 min');
  });

  it('toDateKey / fromDateKey sont réciproques en heure locale', () => {
    const date = new Date(2026, 0, 5, 23, 59);
    expect(toDateKey(date)).toBe('2026-01-05');
    expect(fromDateKey('2026-01-05').getDate()).toBe(5);
  });
});

describe('shiftDateKey', () => {
  it('décale en tenant compte des fins de mois et d’année', () => {
    expect(shiftDateKey('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
  });
});
