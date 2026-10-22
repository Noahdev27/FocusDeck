import { AnimatePresence, motion } from 'framer-motion';
import { Minimize2 } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTimer } from '../../context/TimerContext';
import { MODE_META } from '../../utils/constants';
import { formatClock } from '../../utils/format';
import { ActiveTask } from './ActiveTask';
import { CompletionAlert } from './CompletionAlert';
import { TimerControls } from './TimerControls';
import { TimerRing } from './TimerRing';

interface FocusModeValue {
  open: boolean;
  enter: () => void;
  exit: () => void;
  toggle: () => void;
}

const FocusModeContext = createContext<FocusModeValue | null>(null);

const fullscreenSupported = () => typeof document !== 'undefined' && document.fullscreenEnabled === true;

/**
 * Mode « plein écran concentration » (EF-T06) : le cadran seul, tout le reste masqué et
 * rendu inerte. Utilise l'API Fullscreen quand elle est disponible ; sinon, la vue occupe
 * simplement toute la fenêtre.
 */
export function FocusModeProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Plein écran demandé par FocusDeck : sa sortie (Échap du navigateur) ferme aussi la vue.
  const ownsFullscreen = useRef(false);

  const enter = useCallback(() => {
    setOpen(true);
    if (!fullscreenSupported() || document.fullscreenElement) return;
    document.documentElement
      .requestFullscreen()
      .then(() => {
        ownsFullscreen.current = true;
      })
      .catch(() => undefined); // Refusé (iframe, réglage du navigateur) : la vue reste en fenêtre.
  }, []);

  const exit = useCallback(() => {
    setOpen(false);
    if (ownsFullscreen.current && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    ownsFullscreen.current = false;
  }, []);

  const toggle = useCallback(() => (open ? exit() : enter()), [open, enter, exit]);

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && ownsFullscreen.current) {
        ownsFullscreen.current = false;
        setOpen(false);
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const value = useMemo(() => ({ open, enter, exit, toggle }), [open, enter, exit, toggle]);

  return (
    <FocusModeContext.Provider value={value}>
      {/* `inert` : le reste de l'application n'est ni focalisable ni lu pendant le mode concentration. */}
      <div inert={open} className="contents">
        {children}
      </div>
      <AnimatePresence>{open && <FocusModeView onExit={exit} />}</AnimatePresence>
    </FocusModeContext.Provider>
  );
}

function FocusModeView({ onExit }: { onExit: () => void }) {
  const { mode, status, remainingMs, progress, lastCompletion, toggle, reset, skip } = useTimer();
  const viewRef = useRef<HTMLDivElement>(null);
  const clock = formatClock(remainingMs);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    // Focus sur Démarrer/Pause : Espace et Entrée pilotent le minuteur dès l'ouverture.
    viewRef.current?.querySelector<HTMLButtonElement>('button[aria-label$="(Espace)"]')?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape' || event.code === 'KeyF') {
        event.preventDefault();
        onExit();
      } else if (event.code === 'Space' && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        toggle();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onExit, toggle]);

  return (
    <motion.div
      ref={viewRef}
      role="dialog"
      aria-modal="true"
      aria-label="Mode concentration"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 overflow-y-auto bg-ink-950 px-4 py-10"
    >
      <button
        type="button"
        onClick={onExit}
        className="absolute right-4 top-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100"
      >
        <Minimize2 className="size-4" aria-hidden />
        Quitter <kbd className="font-mono text-xs text-zinc-400">(Échap)</kbd>
      </button>

      <TimerRing mode={mode} progress={progress} running={status === 'running'} pulseKey={lastCompletion?.at ?? null}>
        <div className="flex flex-col items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: MODE_META[mode].from }}>
            {MODE_META[mode].label}
          </span>
          <span
            role="timer"
            aria-live="off"
            aria-label={`Temps restant ${clock}`}
            className="font-mono text-6xl font-semibold tabular-nums tracking-tight text-white sm:text-7xl"
          >
            {clock}
          </span>
        </div>
      </TimerRing>

      <ActiveTask />
      <TimerControls mode={mode} status={status} onToggle={toggle} onReset={reset} onSkip={skip} />
      <div className="w-full max-w-md">
        <CompletionAlert completion={lastCompletion} />
      </div>
    </motion.div>
  );
}

export function useFocusMode(): FocusModeValue {
  const context = useContext(FocusModeContext);
  if (!context) throw new Error('useFocusMode doit être utilisé dans un <FocusModeProvider>.');
  return context;
}
