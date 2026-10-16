import type { SyncStatus } from '../../data';

export interface SyncLabel {
  label: string;
  /** Couleur de la pastille d'état. */
  tone: 'ok' | 'busy' | 'warn' | 'error';
}

/** Libellé lisible du statut de synchronisation (indicateur discret, lot L2). */
export function describeSync(status: SyncStatus): SyncLabel {
  switch (status.state) {
    case 'synced':
      return { label: 'Synchronisé', tone: 'ok' };
    case 'syncing':
      return { label: 'Synchronisation…', tone: 'busy' };
    case 'pending':
      return { label: `${status.pending} modification${status.pending > 1 ? 's' : ''} en attente`, tone: 'busy' };
    case 'offline':
      return {
        label: status.pending > 0 ? `Hors ligne · ${status.pending} en attente` : 'Hors ligne',
        tone: 'warn',
      };
    case 'error':
      return { label: 'Synchronisation interrompue, nouvel essai automatique', tone: 'error' };
  }
}

export const TONE_CLASSES: Record<SyncLabel['tone'], string> = {
  ok: 'bg-emerald-400',
  busy: 'bg-violet-400 animate-pulse',
  warn: 'bg-amber-400',
  error: 'bg-rose-400',
};
