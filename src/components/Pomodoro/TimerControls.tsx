import { AnimatePresence, motion } from 'framer-motion';
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import type { TimerMode, TimerStatus } from '../../types';
import { MODE_META } from '../../utils/constants';
import { IconButton } from '../ui/Button';

interface TimerControlsProps {
  mode: TimerMode;
  status: TimerStatus;
  onToggle: () => void;
  onReset: () => void;
  onSkip: () => void;
}

export function TimerControls({ mode, status, onToggle, onReset, onSkip }: TimerControlsProps) {
  const running = status === 'running';
  const meta = MODE_META[mode];
  const label = running ? 'Pause' : status === 'paused' ? 'Reprendre' : 'Démarrer';

  return (
    <div className="flex items-center justify-center gap-5">
      <IconButton label="Réinitialiser (R)" onClick={onReset} disabled={status === 'idle'} className="size-12 rounded-2xl ring-1 ring-white/10">
        <RotateCcw className="size-5" />
      </IconButton>

      <motion.button
        type="button"
        onClick={onToggle}
        aria-label={`${label} (Espace)`}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.94 }}
        className="relative flex h-16 min-w-44 items-center justify-center gap-2.5 overflow-hidden rounded-[1.4rem] px-8 text-lg font-semibold text-white shadow-xl"
        style={{
          backgroundImage: `linear-gradient(135deg, ${meta.from}, ${meta.to})`,
          boxShadow: `0 18px 40px -12px ${meta.glow}`,
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={running ? 'pause' : 'play'}
            initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
            transition={{ duration: 0.18 }}
          >
            {running ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
          </motion.span>
        </AnimatePresence>
        <span>{label}</span>
      </motion.button>

      <IconButton label="Phase suivante (S)" onClick={onSkip} className="size-12 rounded-2xl ring-1 ring-white/10">
        <SkipForward className="size-5" />
      </IconButton>
    </div>
  );
}
