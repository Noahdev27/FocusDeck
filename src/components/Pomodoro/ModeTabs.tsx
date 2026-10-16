import { motion } from 'framer-motion';
import { Brain, Coffee, Sofa } from 'lucide-react';
import type { TimerMode } from '../../types';
import { MODE_META, TIMER_MODES } from '../../utils/constants';
import { cn } from '../../utils/cn';

const ICONS: Record<TimerMode, typeof Brain> = { focus: Brain, shortBreak: Coffee, longBreak: Sofa };

interface ModeTabsProps {
  mode: TimerMode;
  onChange: (mode: TimerMode) => void;
}

export function ModeTabs({ mode, onChange }: ModeTabsProps) {
  return (
    <div role="tablist" aria-label="Mode du minuteur" className="mx-auto flex w-full max-w-md rounded-2xl bg-black/20 p-1 ring-1 ring-white/[0.06]">
      {TIMER_MODES.map((item) => {
        const Icon = ICONS[item];
        const active = item === mode;
        return (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item)}
            className={cn(
              'relative flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
              active ? 'text-white' : 'text-zinc-400 hover:text-zinc-300',
            )}
          >
            {active && (
              <motion.span
                layoutId="mode-pill"
                className="absolute inset-0 rounded-xl bg-white/[0.08] ring-1 ring-white/10"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <Icon className="relative size-4" style={active ? { color: MODE_META[item].from } : undefined} />
            <span className="relative hidden sm:inline">{MODE_META[item].label}</span>
            <span className="relative sm:hidden">{MODE_META[item].shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
