import type { DailyReport, DayLog, Project, ProjectReportGroup, Task } from '../types';
import { formatDuration, formatLongDate, formatShortDate, formatTime, pluralize, toDateKey } from './format';
import { indexProjects } from './tasks';

export const NO_PROJECT_LABEL = 'Sans projet';

/**
 * Regroupe tâches et temps de focus par projet (lot L4). Le temps d'une session est
 * attribué au projet de sa tâche ; une session sans tâche (ou dont la tâche a disparu)
 * compte pour « Sans projet ». Retourne `[]` quand aucun projet n'est concerné.
 */
export function groupByProject(
  log: DayLog,
  tasks: readonly Task[],
  completedTasks: readonly Task[],
  pendingTasks: readonly Task[],
  projects: readonly Project[],
): ProjectReportGroup[] {
  if (projects.length === 0) return [];
  const byId = indexProjects(projects);
  const taskProject = new Map(tasks.map((task) => [task.id, task.projectId !== null && byId.has(task.projectId) ? task.projectId : null]));
  const keyOf = (task: Task) => taskProject.get(task.id) ?? null;

  const focus = new Map<string | null, number>();
  for (const session of log.sessions) {
    if (session.mode !== 'focus') continue;
    const key = session.taskId === null ? null : (taskProject.get(session.taskId) ?? null);
    focus.set(key, (focus.get(key) ?? 0) + session.durationSeconds);
  }

  const groups: ProjectReportGroup[] = [];
  for (const key of [...projects.map((project) => project.id), null]) {
    const project = key === null ? undefined : byId.get(key);
    const group: ProjectReportGroup = {
      projectId: key,
      name: project?.name ?? NO_PROJECT_LABEL,
      color: project?.color ?? null,
      client: project?.client ?? null,
      focusSeconds: focus.get(key) ?? 0,
      completedTasks: completedTasks.filter((task) => keyOf(task) === key),
      pendingTasks: pendingTasks.filter((task) => keyOf(task) === key),
    };
    if (group.focusSeconds > 0 || group.completedTasks.length > 0 || group.pendingTasks.length > 0) groups.push(group);
  }
  return groups.some((group) => group.projectId !== null) ? groups : [];
}

/** Construit le rapport d'une journée à partir du journal de sessions et des tâches. */
export function buildDailyReport(
  log: DayLog,
  tasks: readonly Task[],
  now: number = Date.now(),
  projects: readonly Project[] = [],
): DailyReport {
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
  // Une tâche reportée à un jour ultérieur n'est ni « à reprendre » ni un échec du jour.
  const postponed = (task: Task) => task.plannedFor !== null && task.plannedFor > log.date;
  const pendingTasks = tasks.filter((task) => !task.completed && !postponed(task));
  const postponedTasks = tasks.filter((task) => !task.completed && postponed(task));
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
    postponedTasks,
    projectGroups: groupByProject(log, tasks, completedTasks, pendingTasks, projects),
  };
}

/** Nom affiché d'un groupe : « Projet (client) ». */
export function groupLabel(group: Pick<ProjectReportGroup, 'name' | 'client'>): string {
  return group.client ? `${group.name} (${group.client})` : group.name;
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
  ];

  const groups = report.projectGroups;
  if (groups.length > 0) {
    lines.push('## Temps par projet', '', '| Projet | Focus | Tâches complétées |', '| --- | --- | --- |');
    for (const group of groups) {
      lines.push(`| ${escapeMarkdown(groupLabel(group))} | ${formatDuration(group.focusSeconds)} | ${group.completedTasks.length} |`);
    }
    lines.push('');
  }

  const doneLine = (task: Task) =>
    `- [x] ${escapeMarkdown(task.title)}${task.completedAt === null ? '' : ` — ${formatTime(task.completedAt)}`}`;
  const pendingLine = (task: Task) => `- [ ] ${escapeMarkdown(task.title)}`;

  /** Liste plate, ou sous-titres par projet quand le rapport est groupé. */
  const taskList = (pick: (group: ProjectReportGroup) => Task[], all: Task[], line: (task: Task) => string, empty: string) => {
    if (all.length === 0) {
      lines.push(empty);
      return;
    }
    if (groups.length === 0) {
      for (const task of all) lines.push(line(task));
      return;
    }
    for (const group of groups) {
      const items = pick(group);
      if (items.length === 0) continue;
      lines.push(`### ${escapeMarkdown(group.name)}`, '');
      for (const task of items) lines.push(line(task));
      lines.push('');
    }
    lines.pop();
  };

  lines.push(`## Tâches complétées (${report.completedTasks.length})`, '');
  taskList((group) => group.completedTasks, report.completedTasks, doneLine, '_Aucune tâche complétée aujourd’hui._');

  lines.push('', `## À reprendre (${report.pendingTasks.length})`, '');
  taskList((group) => group.pendingTasks, report.pendingTasks, pendingLine, '_Rien en attente. Belle journée !_');

  if (report.postponedTasks.length > 0) {
    lines.push('', `## Reportées (${report.postponedTasks.length})`, '');
    for (const task of report.postponedTasks) {
      lines.push(`- [ ] ${escapeMarkdown(task.title)}${task.plannedFor ? ` — prévue ${formatShortDate(task.plannedFor)}` : ''}`);
    }
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
