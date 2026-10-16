import { Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

type Step = { kind: 'form' } | { kind: 'sending' } | { kind: 'sent'; email: string } | { kind: 'error'; message: string };

/** Connexion par lien magique ou Google (EF-C02). */
export function SignInDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'form' });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStep({ kind: 'sending' });
    try {
      await signInWithEmail(email);
      setStep({ kind: 'sent', email: email.trim().toLowerCase() });
    } catch (error) {
      setStep({ kind: 'error', message: error instanceof Error ? error.message : 'Envoi impossible.' });
    }
  };

  const google = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      setStep({ kind: 'error', message: error instanceof Error ? error.message : 'Connexion Google impossible.' });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Se connecter"
      description="Retrouvez vos objectifs et votre historique sur tous vos appareils. Sans compte, FocusDeck reste utilisable."
    >
      {step.kind === 'sent' ? (
        <div role="status" className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/20">
            <Mail className="size-5" aria-hidden />
          </span>
          <p className="text-sm text-zinc-200">
            Lien envoyé à <strong className="text-white">{step.email}</strong>.
          </p>
          <p className="text-sm text-zinc-400">Ouvrez-le sur cet appareil pour terminer la connexion. Vos données locales seront conservées.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
            <label htmlFor="signin-email" className="text-sm font-medium text-zinc-200">
              Adresse e-mail
            </label>
            <input
              id="signin-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="vous@exemple.fr"
              className="h-11 rounded-xl bg-black/30 px-4 text-sm text-white ring-1 ring-white/10 placeholder:text-zinc-400 focus:outline-none focus:ring-violet-400/60"
            />
            <Button type="submit" variant="primary" disabled={step.kind === 'sending'} icon={<Mail className="size-4" />}>
              {step.kind === 'sending' ? 'Envoi…' : 'Recevoir un lien de connexion'}
            </Button>
          </form>
          <div className="flex items-center gap-3 text-xs text-zinc-400" aria-hidden>
            <span className="h-px flex-1 bg-white/10" /> ou <span className="h-px flex-1 bg-white/10" />
          </div>
          <Button onClick={() => void google()}>Continuer avec Google</Button>
          {step.kind === 'error' && (
            <p role="alert" className="text-sm text-rose-300">
              {step.message}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
