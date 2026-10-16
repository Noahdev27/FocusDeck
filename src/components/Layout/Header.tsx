import { AnimatePresence, motion } from 'framer-motion';
import { Keyboard, Settings2 } from 'lucide-react';
import { useTimer } from '../../context/TimerContext';
import { useFocus } from '../../context/FocusContext';
import { MODE_META } from '../../utils/constants';
import { formatClock, formatLongDate } from '../../utils/format';
import { IconButton } from '../ui/Button';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
}

export function Header({ onOpenSettings, onOpenShortcuts }: HeaderProps) {
  const { today } = useFocus();
  const { mode, status, remainingMs } = useTimer();

  return (
    <header className="flex items-center justify-between gap-4 py-5 sm:py-7">
      <div className="flex items-center gap-3">
        <Logo />
        <div>
          <p className="text-lg font-semibold tracking-tight text-white">FocusDeck</p>
          <p className="text-xs capitalize text-zinc-400">{formatLongDate(today)}</p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <AnimatePresence>
          {status !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mr-2 hidden items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5 text-xs ring-1 ring-white/10 sm:flex"
            >
              <span
                className={status === 'running' ? 'size-2 animate-pulse rounded-full' : 'size-2 rounded-full opacity-50'}
                style={{ backgroundColor: MODE_META[mode].from }}
              />
              <span className="text-zinc-400">{MODE_META[mode].label}</span>
              <span className="font-mono tabular-nums text-zinc-100">{formatClock(remainingMs)}</span>
            </motion.div>
          )}
        </AnimatePresence>
        <IconButton label="Raccourcis clavier" onClick={onOpenShortcuts} className="hidden sm:grid">
          <Keyboard className="size-[18px]" />
        </IconButton>
        <IconButton label="Réglages du minuteur" onClick={onOpenSettings}>
          <Settings2 className="size-[18px]" />
        </IconButton>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-9" aria-hidden>
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fb7185" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="rgba(255,255,255,0.06)" />
      <circle
        cx="16"
        cy="16"
        r="9"
        fill="none"
        stroke="url(#logo-gradient)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="44 100"
        transform="rotate(-90 16 16)"
      />
      <circle cx="16" cy="16" r="3" fill="url(#logo-gradient)" />
    </svg>
  );
}
