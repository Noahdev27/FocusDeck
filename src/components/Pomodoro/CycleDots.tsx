import { motion } from 'framer-motion';

interface CycleDotsProps {
  completed: number;
  total: number;
}

/** Progression vers la prochaine pause longue. */
export function CycleDots({ completed, total }: CycleDotsProps) {
  const filled = completed % total === 0 && completed > 0 ? total : completed % total;
  return (
    <div role="img" className="flex items-center gap-1.5" aria-label={`${filled} cycle(s) sur ${total} avant la pause longue`}>
      {Array.from({ length: total }, (_, index) => (
        <motion.span
          key={index}
          className="h-1.5 rounded-full"
          initial={false}
          animate={{
            width: index < filled ? 18 : 6,
            backgroundColor: index < filled ? '#fb7185' : 'rgba(255,255,255,0.15)',
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      ))}
    </div>
  );
}
