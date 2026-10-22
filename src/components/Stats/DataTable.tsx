import type { ReactNode } from 'react';

interface DataTableProps {
  caption: string;
  headers: string[];
  rows: ReactNode[][];
}

/** Tableau de données alternatif d'un graphique, replié par défaut (accessibilité, A11Y). */
export function DataTable({ caption, headers, rows }: DataTableProps) {
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer select-none text-xs font-medium text-zinc-400 hover:text-zinc-200">Voir les données</summary>
      <div className="mt-3 max-h-72 overflow-auto rounded-xl ring-1 ring-white/[0.06]" tabIndex={0} role="region" aria-label={caption}>
        <table className="w-full text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-ink-800 text-xs uppercase tracking-wide text-zinc-400">
            <tr>
              {headers.map((header) => (
                <th key={header} scope="col" className="px-3 py-2 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-white/[0.05]">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className={cellIndex === 0 ? 'px-3 py-1.5 text-zinc-400' : 'px-3 py-1.5 text-zinc-100'}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
