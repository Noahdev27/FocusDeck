import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useTimer } from '../../context/TimerContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useKeyboardShortcuts, type ShortcutMap } from '../../hooks/useKeyboardShortcuts';
import { MODE_META } from '../../utils/constants';
import { formatClock } from '../../utils/format';
import { SettingsDialog } from '../Pomodoro/SettingsDialog';
import { ShortcutsDialog } from './ShortcutsDialog';
import { AmbientBackground } from './AmbientBackground';
import { Header } from './Header';

export function AppShell({ children }: { children: ReactNode }) {
  const timer = useTimer();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useDocumentTitle(
    timer.status === 'idle'
      ? 'FocusDeck'
      : `${timer.status === 'running' ? '▶' : '❚❚'} ${formatClock(timer.remainingMs)} · ${MODE_META[timer.mode].label} — FocusDeck`,
  );

  const { toggle, reset, skip, setMode } = timer;
  const shortcuts = useMemo<ShortcutMap>(
    () => ({
      Space: toggle,
      KeyR: reset,
      KeyS: skip,
      Digit1: () => setMode('focus'),
      Digit2: () => setMode('shortBreak'),
      Digit3: () => setMode('longBreak'),
      Comma: () => setSettingsOpen(true),
    }),
    [toggle, reset, skip, setMode],
  );
  useKeyboardShortcuts(shortcuts);

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);

  return (
    <>
      <AmbientBackground />
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pb-12 sm:px-6 lg:px-8">
        <Header onOpenSettings={openSettings} onOpenShortcuts={openShortcuts} />
        <main className="flex flex-1 flex-col gap-6">{children}</main>
        <footer className="pt-10 text-center text-xs text-zinc-600">
          Données stockées localement dans votre navigateur · FocusDeck
        </footer>
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}
