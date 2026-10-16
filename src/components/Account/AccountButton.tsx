import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useSyncStatus } from '../../data';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';
import { AccountDialog } from './AccountDialog';
import { SignInDialog } from './SignInDialog';
import { describeSync, TONE_CLASSES } from './syncLabels';

/** Accès au compte dans l'en-tête. Invisible tant que Supabase n'est pas configuré. */
export function AccountButton() {
  const { state } = useAuth();
  const { status } = useSyncStatus();
  const [open, setOpen] = useState(false);

  if (state.status === 'disabled' || state.status === 'loading') return null;

  if (state.status === 'signed-out') {
    return (
      <>
        <Button size="sm" variant="secondary" icon={<LogIn className="size-4" />} onClick={() => setOpen(true)} className="mr-1">
          <span className="hidden sm:inline">Se connecter</span>
          <span className="sm:hidden">Connexion</span>
        </Button>
        <SignInDialog open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  const sync = status ? describeSync(status) : null;
  const initial = (state.user.email ?? '?').charAt(0).toUpperCase();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Mon compte${sync ? ` — ${sync.label}` : ''}`}
        title={sync?.label}
        className="relative mr-1 grid size-9 place-items-center rounded-full bg-gradient-to-br from-rose-500 to-violet-500 text-sm font-semibold text-white ring-2 ring-white/10 transition hover:brightness-110"
      >
        {initial}
        {sync && (
          <span
            aria-hidden
            className={cn('absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-ink-900', TONE_CLASSES[sync.tone])}
          />
        )}
      </button>
      <AccountDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
