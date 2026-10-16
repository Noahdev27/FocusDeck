import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Contexte audio factice qui enregistre les oscillateurs créés. */
function installFakeAudio(state: AudioContextState = 'running') {
  const oscillators: { start: ReturnType<typeof vi.fn> }[] = [];
  const resume = vi.fn(async () => undefined);
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  const node = () => ({ gain: param(), connect: vi.fn((target: unknown) => target) });
  class FakeAudioContext {
    state = state;
    currentTime = 0;
    destination = {};
    resume = resume;
    createGain = vi.fn(node);
    createOscillator = vi.fn(() => {
      const osc = { type: 'sine', frequency: param(), connect: vi.fn((t: unknown) => t), start: vi.fn(), stop: vi.fn() };
      oscillators.push(osc);
      return osc;
    });
  }
  vi.stubGlobal('AudioContext', FakeAudioContext);
  return { oscillators, resume };
}

describe('sound', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('joue une mélodie différente selon la phase terminée', async () => {
    const { oscillators } = installFakeAudio();
    const { playChime } = await import('./sound');
    playChime('focus', 0.5);
    expect(oscillators).toHaveLength(4);
    playChime('shortBreak', 0.5);
    expect(oscillators).toHaveLength(7);
  });

  it('ne joue rien à volume nul', async () => {
    const { oscillators } = installFakeAudio();
    const { playChime } = await import('./sound');
    playChime('longBreak', 0);
    expect(oscillators).toHaveLength(0);
  });

  it('réveille un contexte suspendu', async () => {
    const { resume } = installFakeAudio('suspended');
    const { unlockAudio, playChime } = await import('./sound');
    unlockAudio();
    playChime('longBreak', 1);
    expect(resume).toHaveBeenCalledTimes(2);
  });

  it('ne fait rien sans Web Audio', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const { playChime, unlockAudio } = await import('./sound');
    expect(() => {
      unlockAudio();
      playChime('focus', 1);
    }).not.toThrow();
  });
});
