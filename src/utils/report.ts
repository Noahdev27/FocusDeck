import type { DailyReport, DayLog, Task } from '../types';
import { formatDuration, formatLongDate, formatTime, pluralize, toDateKey } from './format';

/** Construit le rapport d'une journée à partir du journal de sessions et des tâches. */
export function buildDailyReport(log: DayLog, tasks: readonly Task[], now: number = Date.now()): DailyReport {
  let completedCycles = 0;
  let focusSeconds = 0;
  let breakSeconds = 0;
  let interruptedSessions = 0;

  for (const session of log.sessions) {
    if (session.mode === 'focus') {
      focusSeconds += session.durationSeconds;
      if (session.completed) completedCycles += 1;
    } else {
      breakSeconds += session.durationSeconds;
    }
    if (!session.completed) interruptedSessions += 1;
  }

  const completedTasks = tasks
    .filter((task) => task.completed && task.completedAt !== null && toDateKey(task.completedAt) === log.date)
    .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0));
  const pendingTasks = tasks.filter((task) => !task.completed);
  const total = completedTasks.length + pendingTasks.length;

  return {
    date: log.date,
    generatedAt: now,
    completedCycles,
    focusSeconds,
    breakSeconds,
    interruptedSessions,
    completedTasks,
    pendingTasks,
    completionRate: total === 0 ? 0 : completedTasks.length / total,
  };
}

/** Échappe les caractères qui casseraient la mise en forme Markdown d'une ligne de liste. */
export function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_[\]<>#|])/g, '\\$1');
}

export function reportToMarkdown(report: DailyReport): string {
  const lines: string[] = [
    `# Rapport FocusDeck — ${formatLongDate(report.date)}`,
    '',
    `_Généré à ${formatTime(report.generatedAt)}_`,
    '',
    '## Résumé',
    '',
    '| Indicateur | Valeur |',
    '| --- | --- |',
    `| Cycles Pomodoro terminés | ${report.completedCycles} |`,
    `| Temps de focus total | ${formatDuration(report.focusSeconds)} |`,
    `| Temps de pause | ${formatDuration(report.breakSeconds)} |`,
    `| Tâches complétées | ${report.completedTasks.length} |`,
    `| Taux de complétion | ${Math.round(report.completionRate * 100)} % |`,
    `| Sessions interrompues | ${report.interruptedSessions} |`,
    '',
    `## Tâches complétées (${report.completedTasks.length})`,
    '',
  ];

  if (report.completedTasks.length === 0) {
    lines.push('_Aucune tâche complétée aujourd’hui._');
  } else {
    for (const task of report.completedTasks) {
      const at = task.completedAt === null ? '' : ` — ${formatTime(task.completedAt)}`;
      lines.push(`- [x] ${escapeMarkdown(task.title)}${at}`);
    }
  }

  lines.push('', `## À reprendre (${report.pendingTasks.length})`, '');
  if (report.pendingTasks.length === 0) {
    lines.push('_Rien en attente. Belle journée !_');
  } else {
    for (const task of report.pendingTasks) lines.push(`- [ ] ${escapeMarkdown(task.title)}`);
  }

  lines.push('', '---', '', `> ${buildHeadline(report)}`, '');
  return lines.join('\n');
}

/** Phrase de synthèse courte, utilisée en conclusion du rapport. */
export function buildHeadline(report: DailyReport): string {
  if (report.completedCycles === 0 && report.completedTasks.length === 0) {
    return 'Pas encore de session aujourd’hui — lancez un premier cycle Focus pour démarrer.';
  }
  return `${pluralize(report.completedCycles, 'cycle')} de focus, ${formatDuration(
    report.focusSeconds,
  )} de concentration et ${pluralize(report.completedTasks.length, 'tâche complétée', 'tâches complétées')}.`;
}

export function reportFilename(report: DailyReport, extension: 'md' | 'pdf'): string {
  return `focusdeck-rapport-${report.date}.${extension}`;
}
