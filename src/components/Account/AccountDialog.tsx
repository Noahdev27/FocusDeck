import { LogOut, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useSyncStatus } from '../../data';
import { formatTime } from '../../utils/format';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { describeSync, TONE_CLASSES } from './syncLabels';

/** Compte connecté : état de la synchronisation et déconnexion (EF-C06). */
export function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, signOut } = useAuth();
  const { status, syncNow } = useSyncStatus();
  const [keepLocalCopy, setKeepLocalCopy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  if (state.status !== 'signed-in') return null;
  const sync = status ? describeSync(status) : null;

  const logout = async () => {
    setError(null);
    try {
      await signOut({ keepLocalCopy });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Déconnexion impossible.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Mon compte" description={state.user.email ?? "Compte FocusDeck"}>
      <section aria-label="Synchronisation" className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-zinc-200">
            {sync && <span aria-hidden className={cn('size-2 rounded-full', TONE_CLASSES[sync.tone])} />}
            {sync?.label ?? 'Préparation…'}
          </p>
          {syncNow && (
            <Button size="sm" icon={<RefreshCw className="size-3.5" />} onClick={() => void syncNow()}>
              Synchroniser
            </Button>
          )}
        </div>
        {status?.lastSyncedAt != null && (
          <p className="mt-1 text-xs text-zinc-400">Dernière synchronisation à {formatTime(status.lastSyncedAt)}</p>
        )}
      </section>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-zinc-200">À la déconnexion</legend>
        <div className="mt-3 flex flex-col gap-2 text-sm">
          {[
            { value: true, label: 'Garder une copie sur cet appareil', hint: 'Vous continuez sans compte avec vos données actuelles.' },
            { value: false, label: 'Effacer les données de cet appareil', hint: 'Recommandé sur un ordinateur partagé. Rien n’est supprimé de votre compte.' },
          ].map((option) => (
            <label key={String(option.value)} className="flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ring-white/[0.06] hover:bg-white/[0.03]">
              <input
                type="radio"
                name="logout-mode"
                checked={keepLocalCopy === option.value}
                onChange={() => setKeepLocalCopy(option.value)}
                className="mt-1 accent-violet-400"
              />
              <span>
                <span className="block text-zinc-200">{option.label}</span>
                <span className="block text-xs text-zinc-400">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-300">
          {error}
        </p>
      )}
      <div className="mt-5 flex justify-end">
        <Button variant="danger" icon={<LogOut className="size-4" />} onClick={() => void logout()}>
          Se déconnecter
        </Button>
      </div>
    </Modal>
  );
}
