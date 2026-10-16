import { useEffect, useRef } from 'react';

export type ShortcutMap = Record<string, (event: KeyboardEvent) => void>;

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * Raccourcis clavier globaux (ignorés pendant la saisie de texte).
 * Les clés correspondent à `KeyboardEvent.code` (ex. `Space`, `KeyR`).
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap, enabled = true): void {
  const shortcutsRef = useRef(shortcuts);
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      // Aucune action globale pendant qu'une boîte de dialogue est ouverte.
      if (document.querySelector('[aria-modal="true"]')) return;
      // Laisse Espace/Entrée activer le bouton focalisé normalement.
      if (event.code === 'Space' && event.target instanceof HTMLButtonElement) return;
      const handler = shortcutsRef.current[event.code];
      if (!handler) return;
      event.preventDefault();
      handler(event);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
