import { Modal } from '../ui/Modal';

const SHORTCUTS: [string, string][] = [
  ['Espace', 'Démarrer / mettre en pause'],
  ['R', 'Réinitialiser la phase'],
  ['S', 'Passer à la phase suivante'],
  ['1 · 2 · 3', 'Focus · Pause courte · Pause longue'],
  ['N', 'Nouvel objectif'],
  [',', 'Ouvrir les réglages'],
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Raccourcis clavier" description="Disponibles hors saisie de texte.">
      <ul className="divide-y divide-white/[0.06]">
        {SHORTCUTS.map(([keys, action]) => (
          <li key={keys} className="flex items-center justify-between py-3 text-sm">
            <span className="text-zinc-300">{action}</span>
            <kbd className="rounded-lg bg-white/[0.06] px-2.5 py-1 font-mono text-xs text-zinc-200 ring-1 ring-white/10">
              {keys}
            </kbd>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
