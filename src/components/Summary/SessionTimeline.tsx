import { motion } from 'framer-motion';
import type { SessionRecord } from '../../types';
import { MODE_META } from '../../utils/constants';
import { formatDuration, formatTime } from '../../utils/format';

/** Frise des sessions de la journée : une barre par phase, proportionnelle à sa durée. */
export function SessionTimeline({ sessions }: { sessions: SessionRecord[] }) {
  if (sessions.length === 0) {
    return (
      <div className="flex h-10 items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-zinc-400">
        La frise de la journée apparaîtra après votre première session.
      </div>
    );
  }

  const total = sessions.reduce((sum, session) => sum + session.durationSeconds, 0);
  const first = sessions[0];
  const last = sessions[sessions.length - 1];
  return (
    <div>
      <div className="flex h-10 w-full gap-1 overflow-hidden rounded-xl">
        {sessions.map((session, index) => {
          const meta = MODE_META[session.mode];
          return (
            <motion.div
              key={session.id}
              title={`${meta.label} · ${formatTime(session.startedAt)} · ${formatDuration(session.durationSeconds)}${
                session.completed ? '' : ' (interrompue)'
              }`}
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: session.completed ? 1 : 0.45 }}
              transition={{ delay: index * 0.03, type: 'spring', stiffness: 300, damping: 26 }}
              className="h-full min-w-1 origin-bottom rounded-md"
              style={{
                flexGrow: session.durationSeconds / total,
                backgroundImage: `linear-gradient(180deg, ${meta.from}, ${meta.to})`,
              }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-zinc-400">
        <span>{first && formatTime(first.startedAt)}</span>
        <span>{last && formatTime(last.endedAt)}</span>
      </div>
    </div>
  );
}
