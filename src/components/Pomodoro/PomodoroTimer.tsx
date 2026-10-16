import { AnimatePresence, motion } from 'framer-motion';
import { Timer } from 'lucide-react';
import { useFocus } from '../../context/FocusContext';
import { useTimer } from '../../context/TimerContext';
import { MODE_META } from '../../utils/constants';
import { formatClock } from '../../utils/format';
import { Card, CardHeader } from '../ui/Card';
import { CompletionAlert } from './CompletionAlert';
import { CycleDots } from './CycleDots';
import { ModeTabs } from './ModeTabs';
import { TimerControls } from './TimerControls';
import { TimerRing } from './TimerRing';

export function PomodoroTimer() {
  const { settings } = useFocus();
  const { mode, status, remainingMs, progress, cyclesInSet, lastCompletion, toggle, reset, skip, setMode } = useTimer();
  const clock = formatClock(remainingMs);
  const nextLongBreakIn = settings.longBreakInterval - (cyclesInSet % settings.longBreakInterval);

  return (
    <Card aria-labelledby="pomodoro-title" className="flex flex-col gap-6">
      <CardHeader
        id="pomodoro-title"
        icon={<Timer className="size-[18px]" />}
        title="Minuteur Pomodoro"
        subtitle={
          mode === 'focus'
            ? `Pause longue dans ${nextLongBreakIn} cycle${nextLongBreakIn > 1 ? 's' : ''}`
            : 'Respirez, étirez-vous, hydratez-vous.'
        }
      />

      <ModeTabs mode={mode} onChange={setMode} />

      <TimerRing mode={mode} progress={progress} running={status === 'running'} pulseKey={lastCompletion?.at ?? null}>
        <div className="flex flex-col items-center gap-3">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={mode}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="text-xs font-semibold uppercase tracking-[0.25em]"
              style={{ color: MODE_META[mode].from }}
            >
              {MODE_META[mode].label}
            </motion.span>
          </AnimatePresence>
          <span
            role="timer"
            aria-live="off"
            aria-label={`Temps restant ${clock}`}
            className="font-mono text-6xl font-semibold tabular-nums tracking-tight text-white sm:text-7xl"
          >
            {clock}
          </span>
          <CycleDots completed={cyclesInSet} total={settings.longBreakInterval} />
          <span className="text-xs text-zinc-500">
            {status === 'paused' ? 'En pause' : status === 'running' ? 'En cours…' : 'Prêt'}
          </span>
        </div>
      </TimerRing>

      <TimerControls mode={mode} status={status} onToggle={toggle} onReset={reset} onSkip={skip} />

      <CompletionAlert completion={lastCompletion} />
    </Card>
  );
}
