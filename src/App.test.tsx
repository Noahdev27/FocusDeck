import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { STORAGE_KEYS } from './utils/constants';

describe('<App />', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('ajoute, coche et persiste un micro-objectif', () => {
    render(<App />);
    const input = screen.getByLabelText('Nouvel objectif');
    fireEvent.change(input, { target: { value: '  Préparer le devis  ' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    const checkbox = screen.getByRole('checkbox', { name: 'Préparer le devis' });
    fireEvent.click(checkbox);
    expect(checkbox.getAttribute('aria-checked')).toBe('true');

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.tasks) ?? '[]') as { title: string; completed: boolean }[];
    expect(stored).toEqual([expect.objectContaining({ title: 'Préparer le devis', completed: true })]);
  });

  it('termine un cycle Focus et passe en pause courte', () => {
    window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ focusMinutes: 1, soundEnabled: false }));
    render(<App />);
    expect(screen.getByRole('timer').textContent).toContain('01:00');

    fireEvent.click(screen.getByRole('button', { name: /Démarrer/ }));
    act(() => {
      vi.advanceTimersByTime(61_000);
    });

    expect(screen.getByRole('tab', { name: /Pause courte/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('status').textContent).toContain('Cycle Focus terminé');
    const logs = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.logs) ?? '{}') as Record<string, { sessions: unknown[] }>;
    expect(Object.values(logs)[0]?.sessions).toHaveLength(1);
  });
});
