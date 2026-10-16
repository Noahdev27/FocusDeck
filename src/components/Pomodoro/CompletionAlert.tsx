import { AnimatePresence, motion } from 'framer-motion';
import { PartyPopper, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PhaseCompletion } from '../../context/TimerContext';
import { MODE_META } from '../../utils/constants';

const VISIBLE_MS = 7000;

/** Bandeau d'alerte visuelle affiché à la fin d'une phase. */
export function CompletionAlert({ completion }: { completion: PhaseCompletion | null }) {
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!completion) return;
    const remaining = completion.at + VISIBLE_MS - Date.now();
    if (remaining <= 0) return;
    const id = window.setTimeout(() => setNow(Date.now()), remaining);
    return () => window.clearTimeout(id);
  }, [completion]);

  const visible =
    completion !== null && dismissedAt !== completion.at && Math.max(now, completion.at) < completion.at + VISIBLE_MS;
  const finishedFocus = completion?.mode === 'focus';

  return (
    <AnimatePresence>
      {visible && completion && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.96 }}
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm"
        >
          <motion.span
            animate={{ rotate: [0, -14, 12, -8, 0] }}
            transition={{ duration: 0.8 }}
            className="grid size-8 shrink-0 place-items-center rounded-xl"
            style={{ backgroundColor: MODE_META[completion.mode].glow }}
          >
            <PartyPopper className="size-4 text-white" />
          </motion.span>
          <p className="flex-1 text-zinc-200">
            <span className="font-semibold text-white">
              {finishedFocus ? 'Cycle Focus terminé !' : `${MODE_META[completion.mode].label} terminée.`}
            </span>{' '}
            {finishedFocus
              ? `Place à la ${MODE_META[completion.nextMode].label.toLowerCase()}.`
              : 'Prêt·e pour un nouveau cycle ?'}
          </p>
          <button
            type="button"
            onClick={() => setDismissedAt(completion.at)}
            className="rounded-lg p-1 text-zinc-400 hover:text-zinc-200"
            aria-label="Masquer"
          >
            <X className="size-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
