import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { TimerMode, TimerSnapshot, TimerStatus } from '../types';
import { usePersistentState } from '../data';
import { MODE_META } from '../utils/constants';
import {
  completePhase,
  createIdleSnapshot,
  getModeDurationMs,
  getRemainingMs,
  pauseTimer,
  skipPhase,
  startTimer,
  switchMode,
  type PhaseTransition,
} from '../utils/timer';
import { playChime, unlockAudio } from '../utils/sound';
import { sendNotification } from '../utils/notify';
import { useFocus } from './FocusContext';

export interface PhaseCompletion {
  mode: TimerMode;
  nextMode: TimerMode;
  at: number;
}

export interface TimerContextValue {
  mode: TimerMode;
  status: TimerStatus;
  remainingMs: number;
  durationMs: number;
  /** Progression de la phase courante, entre 0 et 1. */
  progress: number;
  cyclesInSet: number;
  lastCompletion: PhaseCompletion | null;
  start: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
  skip: () => void;
  setMode: (mode: TimerMode) => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

const TICK_MS = 250;

export function TimerProvider({ children }: { children: ReactNode }) {
  const { settings, recordSession } = useFocus();
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const [storedSnapshot, setStoredSnapshot] = usePersistentState('timer');
  // Première visite : aucun minuteur enregistré, on part d'un Focus inactif.
  const snapshot = useMemo(
    () => storedSnapshot ?? createIdleSnapshot('focus', settings),
    [storedSnapshot, settings],
  );
  const setSnapshot = useCallback(
    (next: TimerSnapshot | ((previous: TimerSnapshot) => TimerSnapshot)) =>
      setStoredSnapshot((previous) => {
        const base = previous ?? createIdleSnapshot('focus', settingsRef.current);
        return typeof next === 'function' ? next(base) : next;
      }),
    [setStoredSnapshot],
  );
  const [now, setNow] = useState(() => Date.now());
  const [lastCompletion, setLastCompletion] = useState<PhaseCompletion | null>(null);

  // Applique une transition : historise la phase sortante puis change d'état.
  const apply = useCallback(
    (transition: PhaseTransition) => {
      if (transition.record) recordSession(transition.record);
      setSnapshot(transition.next);
      setNow(Date.now());
    },
    [recordSession, setSnapshot],
  );

  // Tick : uniquement pendant que le minuteur tourne. Le temps restant est dérivé
  // de `endsAt`, donc aucune dérive même si les intervalles sont ralentis.
  useEffect(() => {
    if (snapshot.status !== 'running' || snapshot.endsAt === null) return;
    const refresh = () => setNow(Date.now());
    const interval = window.setInterval(refresh, TICK_MS);
    // Timeout précis pour la fin de phase (les intervalles sont bridés en arrière-plan).
    const timeout = window.setTimeout(refresh, Math.max(0, snapshot.endsAt - Date.now()) + 20);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [snapshot.status, snapshot.endsAt]);

  // Détection de fin de phase. Le garde évite un double déclenchement (StrictMode, re-rendus).
  const completedKey = useRef<number | null>(null);
  const remainingMs = getRemainingMs(snapshot, now);
  useEffect(() => {
    if (snapshot.status !== 'running' || snapshot.endsAt === null || remainingMs > 0) return;
    if (completedKey.current === snapshot.endsAt) return;
    completedKey.current = snapshot.endsAt;

    const current = settingsRef.current;
    const transition = completePhase(snapshot, current, Date.now());
    apply(transition);

    const finished = snapshot.mode;
    const nextMode = transition.next.mode;
    setLastCompletion({ mode: finished, nextMode, at: Date.now() });
    if (current.soundEnabled) playChime(finished, current.volume);
    if (current.notificationsEnabled) {
      sendNotification(
        finished === 'focus' ? 'Cycle Focus terminé 🎉' : 'Pause terminée',
        finished === 'focus'
          ? `Place à la ${MODE_META[nextMode].label.toLowerCase()}.`
          : 'On reprend le focus ?',
      );
    }
  }, [snapshot, remainingMs, apply]);

  // Réglages modifiés : une phase inactive adopte immédiatement la nouvelle durée.
  const focusMinutes = settings.focusMinutes;
  const shortMinutes = settings.shortBreakMinutes;
  const longMinutes = settings.longBreakMinutes;
  useEffect(() => {
    setSnapshot((previous) => {
      if (previous.status !== 'idle') return previous;
      const durationMs = getModeDurationMs(previous.mode, settingsRef.current);
      if (durationMs === previous.durationMs) return previous;
      return { ...previous, durationMs, remainingMs: durationMs };
    });
  }, [focusMinutes, shortMinutes, longMinutes, setSnapshot]);

  const start = useCallback(() => {
    unlockAudio();
    setSnapshot((previous) => startTimer(previous, Date.now()));
    setNow(Date.now());
  }, [setSnapshot]);

  const pause = useCallback(() => {
    setSnapshot((previous) => pauseTimer(previous, Date.now()));
    setNow(Date.now());
  }, [setSnapshot]);

  const toggle = useCallback(() => {
    if (snapshot.status === 'running') pause();
    else start();
  }, [snapshot.status, pause, start]);

  const reset = useCallback(
    () => apply(switchMode(snapshot, snapshot.mode, settingsRef.current, Date.now())),
    [apply, snapshot],
  );

  const skip = useCallback(() => apply(skipPhase(snapshot, settingsRef.current, Date.now())), [apply, snapshot]);

  const setMode = useCallback(
    (mode: TimerMode) => {
      if (mode === snapshot.mode && snapshot.status === 'idle') return;
      apply(switchMode(snapshot, mode, settingsRef.current, Date.now()));
    },
    [apply, snapshot],
  );

  const value = useMemo<TimerContextValue>(
    () => ({
      mode: snapshot.mode,
      status: snapshot.status,
      remainingMs,
      durationMs: snapshot.durationMs,
      progress: snapshot.durationMs === 0 ? 0 : 1 - remainingMs / snapshot.durationMs,
      cyclesInSet: snapshot.cyclesInSet,
      lastCompletion,
      start,
      pause,
      toggle,
      reset,
      skip,
      setMode,
    }),
    [snapshot, remainingMs, lastCompletion, start, pause, toggle, reset, skip, setMode],
  );

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimer(): TimerContextValue {
  const context = useContext(TimerContext);
  if (!context) throw new Error('useTimer doit être utilisé dans un <TimerProvider>.');
  return context;
}
