import { useTimer } from '../../context/TimerContext';
import { MODE_META, TIMER_MODES } from '../../utils/constants';
import { cn } from '../../utils/cn';

/**
 * Halo coloré en fond de page, qui suit le mode du minuteur.
 *
 * Performance : un calque pré-coloré par mode, et seule l'opacité change (transition
 * CSS, composée par le GPU). Animer la couleur de grands éléments floutés forçait un
 * nouveau rendu du flou à chaque image (temps de blocage > 2 s sur mobile).
 */
export function AmbientBackground() {
  const { mode, status } = useTimer();
  const intensity = status === 'running' ? 0.55 : 0.35;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {TIMER_MODES.map((item) => {
        const active = item === mode;
        return (
          <div key={item} className="absolute inset-0 transition-opacity duration-[1200ms] ease-in-out" style={{ opacity: active ? 1 : 0 }}>
            <div
              className={cn('absolute -top-48 left-1/2 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full blur-[120px]', 'transition-opacity duration-700')}
              style={{ backgroundColor: MODE_META[item].from, opacity: intensity }}
            />
            <div
              className="absolute -right-40 bottom-[-12rem] h-[34rem] w-[34rem] rounded-full blur-[130px] transition-opacity duration-700"
              style={{ backgroundColor: MODE_META[item].to, opacity: intensity * 0.6 }}
            />
          </div>
        );
      })}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,var(--color-ink-950)_70%)]" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22><circle cx=%221%22 cy=%221%22 r=%221%22 fill=%22white%22 fill-opacity=%220.035%22/></svg>')]" />
    </div>
  );
}
