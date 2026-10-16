import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { TimerMode } from '../../types';
import { MODE_META, TIMER_MODES } from '../../utils/constants';
import { cn } from '../../utils/cn';

interface TimerRingProps {
  mode: TimerMode;
  progress: number;
  running: boolean;
  /** Déclenche une pulsation visuelle (fin de phase). */
  pulseKey: number | null;
  children: ReactNode;
}

const SIZE = 320;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function TimerRing({ mode, progress, running, pulseKey, children }: TimerRingProps) {
  const meta = MODE_META[mode];
  const clamped = Math.min(1, Math.max(0, progress));
  // Le SVG est pivoté de -90° : l'angle 0 correspond au haut du cadran.
  const angle = clamped * 2 * Math.PI;
  const center = SIZE / 2;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[19rem] sm:max-w-[20rem]">
      {/* Halo : un calque par mode, transition d'opacité et pulsation en CSS (composées par le GPU). */}
      {TIMER_MODES.map((item) => (
        <div
          key={item}
          aria-hidden
          className={cn(
            'absolute inset-6 rounded-full blur-3xl transition-opacity duration-700',
            running && item === mode && 'motion-safe:animate-[halo_4s_ease-in-out_infinite]',
          )}
          style={{ backgroundColor: MODE_META[item].glow, opacity: item === mode ? 1 : 0 }}
        />
      ))}
      {/* Onde de fin de phase */}
      {pulseKey !== null && (
        <motion.div
          key={pulseKey}
          aria-hidden
          className="absolute inset-0 rounded-full border-2"
          style={{ borderColor: meta.from }}
          initial={{ opacity: 0.9, scale: 0.92 }}
          animate={{ opacity: 0, scale: 1.25 }}
          transition={{ duration: 1.4, ease: 'easeOut', repeat: 2 }}
        />
      )}

      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="relative size-full -rotate-90">
        <defs>
          <linearGradient id="ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <motion.stop offset="0" initial={false} animate={{ stopColor: meta.from }} transition={{ duration: 0.8 }} />
            <motion.stop offset="1" initial={false} animate={{ stopColor: meta.to }} transition={{ duration: 0.8 }} />
          </linearGradient>
        </defs>
        <circle cx={center} cy={center} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={STROKE} />
        {/* Graduations */}
        {Array.from({ length: 60 }, (_, i) => {
          const a = (i / 60) * 2 * Math.PI;
          const inner = RADIUS - STROKE - (i % 5 === 0 ? 8 : 4);
          const outer = RADIUS - STROKE - 1;
          return (
            <line
              key={i}
              x1={center + inner * Math.cos(a)}
              y1={center + inner * Math.sin(a)}
              x2={center + outer * Math.cos(a)}
              y2={center + outer * Math.sin(a)}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={i % 5 === 0 ? 1.5 : 1}
            />
          );
        })}
        <motion.circle
          cx={center}
          cy={center}
          r={RADIUS}
          fill="none"
          stroke="url(#ring-gradient)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={false}
          animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - clamped) }}
          transition={{ duration: running ? 0.3 : 0.6, ease: running ? 'linear' : 'easeOut' }}
        />
        {clamped > 0.002 && (
          <motion.circle
            r={STROKE / 2 + 3}
            fill="#fff"
            initial={false}
            animate={{ cx: center + RADIUS * Math.cos(angle), cy: center + RADIUS * Math.sin(angle) }}
            transition={{ duration: running ? 0.3 : 0.6, ease: running ? 'linear' : 'easeOut' }}
            style={{ filter: `drop-shadow(0 0 8px ${meta.from})` }}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
