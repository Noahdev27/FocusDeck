import { Fragment, type ReactNode } from 'react';

/**
 * Rendu minimaliste du sous-ensemble Markdown produit par `reportToMarkdown`
 * (titres, tableaux, listes à cocher, italique, citations). Le contenu est
 * rendu en éléments React — aucun HTML injecté, donc aucun risque XSS.
 */
export function MarkdownPreview({ markdown }: { markdown: string }) {
  const lines = markdown.split('\n');
  const blocks: ReactNode[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const key = `l${index}`;

    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (index < lines.length && (lines[index] ?? '').startsWith('|')) {
        const cells = splitRow(lines[index] ?? '');
        if (!cells.every((cell) => /^-+$/.test(cell))) rows.push(cells);
        index += 1;
      }
      index -= 1;
      const [head, ...body] = rows;
      blocks.push(
        <table key={key} className="my-3 w-full overflow-hidden rounded-xl text-sm">
          {head && (
            <thead>
              <tr className="bg-white/[0.05] text-left text-xs uppercase tracking-wide text-zinc-400">
                {head.map((cell) => (
                  <th key={cell} className="px-3 py-2 font-medium">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {body.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-white/[0.05]">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className={cellIndex === 0 ? 'px-3 py-2 text-zinc-400' : 'px-3 py-2 font-medium text-white'}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      );
    } else if (line.startsWith('# ')) {
      blocks.push(
        <h1 key={key} className="mb-1 text-xl font-semibold tracking-tight text-white">
          {line.slice(2)}
        </h1>,
      );
    } else if (line.startsWith('## ')) {
      blocks.push(
        <h2 key={key} className="mt-5 mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-300">
          {line.slice(3)}
        </h2>,
      );
    } else if (/^- \[( |x)\] /.test(line)) {
      const done = line[3] === 'x';
      blocks.push(
        <p key={key} className="flex items-start gap-2 py-0.5 text-sm">
          <span
            className={
              done
                ? 'mt-1 size-3.5 shrink-0 rounded bg-gradient-to-br from-emerald-400 to-cyan-400'
                : 'mt-1 size-3.5 shrink-0 rounded border border-zinc-600'
            }
          />
          <span className={done ? 'text-zinc-200' : 'text-zinc-400'}>{unescape(line.slice(6))}</span>
        </p>,
      );
    } else if (line.startsWith('> ')) {
      blocks.push(
        <blockquote key={key} className="mt-3 border-l-2 border-violet-400/60 pl-3 text-sm italic text-violet-200">
          {line.slice(2)}
        </blockquote>,
      );
    } else if (line === '---') {
      blocks.push(<hr key={key} className="my-4 border-white/[0.06]" />);
    } else if (/^_.*_$/.test(line)) {
      blocks.push(
        <p key={key} className="text-sm italic text-zinc-400">
          {line.slice(1, -1)}
        </p>,
      );
    } else if (line.trim() !== '') {
      blocks.push(
        <p key={key} className="text-sm text-zinc-300">
          {line}
        </p>,
      );
    }
  }

  return <Fragment>{blocks}</Fragment>;
}

function splitRow(row: string): string[] {
  return row
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());
}

function unescape(text: string): string {
  return text.replace(/\\(.)/g, '$1');
}
