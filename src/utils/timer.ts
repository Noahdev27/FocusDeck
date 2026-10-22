import type { TimerMode, TimerSettings, TimerSnapshot } from '../types';

export function getModeDurationMs(mode: TimerMode, settings: TimerSettings): number {
  const minutes =
    mode === 'focus'
      ? settings.focusMinutes
      : mode === 'shortBreak'
        ? settings.shortBreakMinutes
        : settings.longBreakMinutes;
  return minutes * 60_000;
}

/**
 * Détermine la phase suivante après la fin de `mode`.
 * `cyclesInSet` est le nombre de cycles Focus terminés, y compris celui qui vient de finir.
 */
export function getNextMode(mode: TimerMode, cyclesInSet: number, longBreakInterval: number): TimerMode {
  if (mode !== 'focus') return 'focus';
  return cyclesInSet > 0 && cyclesInSet % longBreakInterval === 0 ? 'longBreak' : 'shortBreak';
}

export function createIdleSnapshot(
  mode: TimerMode,
  settings: TimerSettings,
  cyclesInSet = 0,
  taskId: string | null = null,
): TimerSnapshot {
  const durationMs = getModeDurationMs(mode, settings);
  return { mode, status: 'idle', remainingMs: durationMs, endsAt: null, durationMs, startedAt: null, cyclesInSet, taskId };
}

/** Temps restant à l'instant `now`, quel que soit le statut. */
export function getRemainingMs(snapshot: TimerSnapshot, now: number): number {
  if (snapshot.status === 'running' && snapshot.endsAt !== null) {
    return Math.max(0, snapshot.endsAt - now);
  }
  return snapshot.remainingMs;
}

export function getElapsedMs(snapshot: TimerSnapshot, now: number): number {
  return Math.max(0, snapshot.durationMs - getRemainingMs(snapshot, now));
}

export function startTimer(snapshot: TimerSnapshot, now: number): TimerSnapshot {
  if (snapshot.status === 'running') return snapshot;
  return {
    ...snapshot,
    status: 'running',
    endsAt: now + snapshot.remainingMs,
    startedAt: snapshot.startedAt ?? now,
  };
}

export function pauseTimer(snapshot: TimerSnapshot, now: number): TimerSnapshot {
  if (snapshot.status !== 'running') return snapshot;
  return { ...snapshot, status: 'paused', remainingMs: getRemainingMs(snapshot, now), endsAt: null };
}

export interface PhaseTransition {
  next: TimerSnapshot;
  /** Session à enregistrer pour la phase qui se termine (null si rien d'écoulé). */
  record: {
    mode: TimerMode;
    startedAt: number;
    endedAt: number;
    durationSeconds: number;
    completed: boolean;
    /** Tâche active, uniquement pour un cycle Focus (EF-T03). */
    taskId: string | null;
  } | null;
}

/**
 * Identifiant déterministe d'une session : une même phase (mode + début) terminée sur
 * deux appareils synchronisés produit le même identifiant, donc une seule ligne (EF-T04).
 */
export function sessionIdFor(mode: TimerMode, startedAt: number): string {
  return `${mode}:${startedAt}`;
}

/** En dessous de ce seuil, une phase interrompue n'est pas historisée (clic accidentel). */
export const MIN_RECORDED_PARTIAL_MS = 10_000;

function buildRecord(snapshot: TimerSnapshot, endedAt: number, elapsedMs: number, completed: boolean) {
  if (!completed && elapsedMs < MIN_RECORDED_PARTIAL_MS) return null;
  const durationSeconds = Math.round(elapsedMs / 1000);
  if (durationSeconds <= 0) return null;
  return {
    mode: snapshot.mode,
    startedAt: snapshot.startedAt ?? endedAt - elapsedMs,
    endedAt,
    durationSeconds,
    completed,
    taskId: snapshot.mode === 'focus' ? snapshot.taskId : null,
  };
}

/**
 * Fin naturelle d'une phase : comptabilise le cycle, choisit la phase suivante
 * et la démarre automatiquement si les réglages le demandent.
 */
export function completePhase(snapshot: TimerSnapshot, settings: TimerSettings, now: number): PhaseTransition {
  const endedAt = snapshot.endsAt !== null ? Math.min(snapshot.endsAt, now) : now;
  const record = buildRecord(snapshot, endedAt, snapshot.durationMs, true);

  const cyclesInSet =
    snapshot.mode === 'focus'
      ? snapshot.cyclesInSet + 1
      : snapshot.mode === 'longBreak'
        ? 0
        : snapshot.cyclesInSet;
  const nextMode = getNextMode(snapshot.mode, cyclesInSet, settings.longBreakInterval);
  const idle = createIdleSnapshot(nextMode, settings, cyclesInSet, snapshot.taskId);
  const autoStart = nextMode === 'focus' ? settings.autoStartFocus : settings.autoStartBreaks;

  // Si la fin est récente, on enchaîne précisément ; sinon (onglet rouvert bien
  // plus tard), on repart de maintenant pour éviter des complétions en cascade.
  const chainFrom = now - endedAt < 5_000 ? endedAt : now;
  return { next: autoStart ? startTimer(idle, chainFrom) : idle, record };
}

/** Passe à la phase suivante sans compter de cycle ; le temps déjà écoulé est conservé. */
export function skipPhase(snapshot: TimerSnapshot, settings: TimerSettings, now: number): PhaseTransition {
  const record = buildRecord(snapshot, now, getElapsedMs(snapshot, now), false);
  const nextMode: TimerMode = snapshot.mode === 'focus' ? 'shortBreak' : 'focus';
  const cyclesInSet = snapshot.mode === 'longBreak' ? 0 : snapshot.cyclesInSet;
  return { next: createIdleSnapshot(nextMode, settings, cyclesInSet, snapshot.taskId), record };
}

/** Change de mode (ou réinitialise le mode courant) en conservant le temps écoulé. */
export function switchMode(
  snapshot: TimerSnapshot,
  mode: TimerMode,
  settings: TimerSettings,
  now: number,
): PhaseTransition {
  const record = buildRecord(snapshot, now, getElapsedMs(snapshot, now), false);
  return { next: createIdleSnapshot(mode, settings, snapshot.cyclesInSet, snapshot.taskId), record };
}

/** Associe (ou détache avec `null`) la tâche active, sans toucher au décompte. */
export function assignTask(snapshot: TimerSnapshot, taskId: string | null): TimerSnapshot {
  return snapshot.taskId === taskId ? snapshot : { ...snapshot, taskId };
}

/**
 * « Lancer un focus sur cette tâche » (EF-T03) : associe la tâche puis démarre un cycle
 * Focus. Depuis une pause, la pause en cours est historisée comme interrompue ; un Focus
 * déjà commencé continue, désormais attribué à la nouvelle tâche.
 */
export function focusOnTask(snapshot: TimerSnapshot, taskId: string, settings: TimerSettings, now: number): PhaseTransition {
  if (snapshot.mode !== 'focus') {
    const { next, record } = switchMode(snapshot, 'focus', settings, now);
    return { next: startTimer(assignTask(next, taskId), now), record };
  }
  return { next: startTimer(assignTask(snapshot, taskId), now), record: null };
}
