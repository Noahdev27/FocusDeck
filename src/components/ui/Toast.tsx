import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export interface ToastOptions {
  message: string;
  /** Action proposée (ex. « Annuler »). */
  action?: { label: string; onAction: () => void };
  /** Durée d'affichage en millisecondes (5 s par défaut). */
  duration?: number;
  /**
   * Donne le focus à l'action : à utiliser quand le déclencheur disparaît sous le doigt
   * d'un utilisateur clavier (ex. bouton « Supprimer » d'une tâche supprimée).
   */
  focusAction?: boolean;
}

interface ToastEntry extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  show: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 5_000;
const MAX_VISIBLE = 3;

/**
 * Notifications éphémères (EF-O06). La région est annoncée poliment aux lecteurs d'écran ;
 * le compte à rebours se suspend au survol et au focus (WCAG 2.2.1, durée réglable) ;
 * Échap ferme la notification focalisée.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((previous) => previous.filter((toast) => toast.id !== id)), []);
  const show = useCallback((options: ToastOptions) => {
    nextId.current += 1;
    const entry = { ...options, id: nextId.current };
    setToasts((previous) => [...previous, entry].slice(-MAX_VISIBLE));
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <section
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        <div aria-live="polite" aria-relevant="additions text" className="flex w-full flex-col items-center gap-2">
          <AnimatePresence initial={false}>
            {toasts.map((toast) => (
              <ToastView key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
            ))}
          </AnimatePresence>
        </div>
      </section>
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: ToastEntry; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const actionRef = useRef<HTMLButtonElement>(null);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const duration = toast.duration ?? DEFAULT_DURATION_MS;
  // Temps restant conservé entre deux suspensions du compte à rebours.
  const remaining = useRef(duration);
  const halted = paused || hovered;
  useEffect(() => {
    if (halted) return;
    const startedAt = Date.now();
    const id = window.setTimeout(() => onDismissRef.current(), remaining.current);
    return () => {
      window.clearTimeout(id);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt));
    };
  }, [halted]);

  useEffect(() => {
    if (toast.focusAction) actionRef.current?.focus();
  }, [toast.focusAction]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onDismiss();
        }
      }}
      className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-white/10 bg-ink-700/95 py-2 pl-4 pr-2 text-sm text-zinc-100 shadow-2xl"
    >
      <p className="min-w-0 flex-1">{toast.message}</p>
      {toast.action && (
        <button
          ref={actionRef}
          type="button"
          onClick={() => {
            toast.action?.onAction();
            onDismiss();
          }}
          className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold text-violet-200 transition hover:bg-white/[0.08]"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Fermer la notification"
        onClick={onDismiss}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/[0.08] hover:text-zinc-100"
      >
        <X className="size-4" />
      </button>
    </motion.div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast doit être utilisé dans un <ToastProvider>.');
  return context;
}
