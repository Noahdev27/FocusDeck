import type { ProjectShare } from '../../domain/stats';
import { formatDuration } from '../../utils/format';

/**
 * Répartition du temps de focus par projet (EF-R03). Chaque barre porte la couleur de son
 * projet (l'identité suit l'entité, jamais le rang) et son nom en clair : la couleur seule
 * n'identifie jamais un projet.
 */
export function ProjectBreakdown({ shares }: { shares: ProjectShare[] }) {
  const total = shares.reduce((sum, share) => sum + share.focusSeconds, 0);
  if (total === 0) return <p className="text-sm text-zinc-400">Aucun focus sur la période.</p>;
  const max = Math.max(...shares.map((share) => share.focusSeconds));
  return (
    <ul className="flex flex-col gap-3">
      {shares.map((share) => {
        const percent = Math.round((share.focusSeconds / total) * 100);
        return (
          <li key={share.projectId ?? 'none'}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-zinc-200">
                <span aria-hidden className="size-2 shrink-0 rounded-full bg-zinc-500" style={share.color ? { backgroundColor: share.color } : undefined} />
                <span className="truncate">{share.name}</span>
              </span>
              <span className="shrink-0 tabular-nums text-zinc-400">
                <span className="font-medium text-zinc-100">{formatDuration(share.focusSeconds)}</span> · {percent} %
              </span>
            </div>
            <div aria-hidden className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className="h-full rounded-r-[4px] bg-zinc-500"
                style={{ width: `${(share.focusSeconds / max) * 100}%`, ...(share.color ? { backgroundColor: share.color } : {}) }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
