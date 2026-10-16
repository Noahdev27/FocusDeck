import { motion } from 'framer-motion';
import { useTimer } from '../../context/TimerContext';
import { MODE_META } from '../../utils/constants';

/** Halo coloré en fond de page, qui suit le mode du minuteur. */
export function AmbientBackground() {
  const { mode, status } = useTimer();
  const meta = MODE_META[mode];
  const intensity = status === 'running' ? 0.55 : 0.35;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute -top-48 left-1/2 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full blur-[120px]"
        animate={{ backgroundColor: meta.from, opacity: intensity }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-40 bottom-[-12rem] h-[34rem] w-[34rem] rounded-full blur-[130px]"
        animate={{ backgroundColor: meta.to, opacity: intensity * 0.6 }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,var(--color-ink-950)_70%)]" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22><circle cx=%221%22 cy=%221%22 r=%221%22 fill=%22white%22 fill-opacity=%220.035%22/></svg>')]" />
    </div>
  );
}
