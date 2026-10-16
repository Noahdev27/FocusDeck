import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent: string;
}

export function StatCard({ icon, label, value, hint, accent }: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
      <span aria-hidden className="absolute -right-6 -top-6 size-20 rounded-full opacity-20 blur-2xl" style={{ backgroundColor: accent }} />
      <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
        <span style={{ color: accent }}>{icon}</span>
        {label}
      </div>
      <div className="mt-2 h-8 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p
            key={value}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="text-2xl font-semibold tabular-nums tracking-tight text-white"
          >
            {value}
          </motion.p>
        </AnimatePresence>
      </div>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}
