import type { TimerMode } from '../types';

type AudioContextConstructor = typeof AudioContext;

let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor: AudioContextConstructor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  if (!Ctor) return null;
  sharedContext ??= new Ctor();
  return sharedContext;
}

/**
 * À appeler lors d'une interaction utilisateur : les navigateurs bloquent
 * l'audio tant que le contexte n'a pas été « débloqué » par un geste.
 */
export function unlockAudio(): void {
  const ctx = getAudioContext();
  if (ctx?.state === 'suspended') void ctx.resume();
}

const MELODIES: Record<TimerMode, number[]> = {
  // Fin d'un Focus : arpège montant, joyeux.
  focus: [523.25, 659.25, 783.99, 1046.5],
  // Fin d'une pause : rappel plus doux pour reprendre.
  shortBreak: [783.99, 659.25, 523.25],
  longBreak: [783.99, 659.25, 523.25, 392.0],
};

/** Joue un carillon synthétisé (aucun fichier audio requis). */
export function playChime(finishedMode: TimerMode, volume: number): void {
  const ctx = getAudioContext();
  if (!ctx || volume <= 0) return;
  if (ctx.state === 'suspended') void ctx.resume();

  const master = ctx.createGain();
  master.gain.value = Math.min(1, Math.max(0, volume)) * 0.5;
  master.connect(ctx.destination);

  const start = ctx.currentTime + 0.02;
  MELODIES[finishedMode].forEach((frequency, index) => {
    const at = start + index * 0.16;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(1, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);
    osc.connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + 0.65);
  });
}
