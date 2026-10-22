import { focusByProject, totalsOf } from '../domain/stats';
import type { DayLog, Project, ProjectReportGroup, Report, ReportSession, SessionRecord, Task } from '../types';
import { formatDuration, formatLongDate, formatShortDate, formatTime, pluralize, toDateKey } from './format';
import { indexProjects, matchesFilters, type ProjectFilter } from './tasks';

export const NO_PROJECT_LABEL = 'Sans projet';

export interface ReportRange {
  from: string;
  to: string;
}

export interface ReportFilters {
  /** `all`, `none` (sans projet) ou l'identifiant d'un projet. */
  projectId: ProjectFilter;
}

export interface ReportData {
  logs: Record<string, DayLog>;
  tasks: readonly Task[];
  projects: readonly Project[];
}

/**
 * Regroupe tâches et temps de focus par projet (lot L4). Le temps d'une session est
 * attribué au projet de sa tâche ; une session sans tâche (ou dont la tâche a disparu)
 * compte pour « Sans projet ». Retourne `[]` quand aucun projet n'est concerné.
 */
export function groupByProject(
  sessions: readonly SessionRecord[],
  tasks: readonly Task[],
  completedTasks: readonly Task[],
  pendingTasks: readonly Task[],
  projects: readonly Project[],
): ProjectReportGroup[] {
  if (projects.length === 0) return [];
  const byId = indexProjects(projects);
  const taskProject = new Map(tasks.map((task) => [task.id, task.projectId !== null && byId.has(task.projectId) ? task.projectId : null]));
  const keyOf = (task: Task) => taskProject.get(task.id) ?? null;
  // Même calcul que la page Statistiques : les totaux concordent par construction.
  const focus = new Map(focusByProject(sessions, tasks, projects).map((share) => [share.projectId, share.focusSeconds]));

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

/**
 * Rapport d'une période (EF-R02), filtrable par projet. Les sessions sont rattachées à un
 * projet par leur tâche ; les tâches « à reprendre » ne figurent que si la période atteint
 * aujourd'hui (pour une période passée, elles n'ont pas de sens).
 */
export function buildReport(range: ReportRange, filters: ReportFilters, data: ReportData, now: number = Date.now()): Report {
  const { logs, tasks, projects } = data;
  const byId = indexProjects(projects);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const projectOf = (taskId: string | null): string | null => {
    const projectId = taskId === null ? null : (taskById.get(taskId)?.projectId ?? null);
    return projectId !== null && byId.has(projectId) ? projectId : null;
  };
  const sessionMatches = (session: SessionRecord) => {
    if (filters.projectId === 'all') return true;
    const projectId = projectOf(session.taskId);
    return filters.projectId === 'none' ? projectId === null : projectId === filters.projectId;
  };
  const taskMatches = (task: Task) => {
    const known = { ...task, projectId: task.projectId !== null && byId.has(task.projectId) ? task.projectId : null };
    return matchesFilters(known, 'all', filters.projectId);
  };

  const sessions: ReportSession[] = Object.values(logs)
    .filter((log) => log.date >= range.from && log.date <= range.to)
    .flatMap((log) => log.sessions.filter(sessionMatches).map((session) => ({ date: log.date, session })))
    .sort((a, b) => a.session.startedAt - b.session.startedAt)
    .map(({ date, session }) => {
      const projectId = projectOf(session.taskId);
      return {
        date,
        session,
        taskTitle: session.taskId === null ? null : (taskById.get(session.taskId)?.title ?? null),
        projectName: projectId === null ? null : (byId.get(projectId)?.name ?? null),
      };
    });

  const records = sessions.map(({ session }) => session);
  const totals = totalsOf(range.from, records);
  const interruptedSessions = records.filter((session) => !session.completed).length;

  const scoped = tasks.filter(taskMatches);
  const completedTasks = scoped
    .filter((task) => {
      if (!task.completed || task.completedAt === null) return false;
      const day = toDateKey(task.completedAt);
      return day >= range.from && day <= range.to;
    })
    .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0));
  // Une tâche reportée au-delà de la période n'est ni « à reprendre » ni un échec de la période.
  const postponed = (task: Task) => task.plannedFor !== null && task.plannedFor > range.to;
  const reachesToday = range.to >= toDateKey(now);
  const pendingTasks = reachesToday ? scoped.filter((task) => !task.completed && !postponed(task)) : [];
  const postponedTasks = reachesToday ? scoped.filter((task) => !task.completed && postponed(task)) : [];
  const total = completedTasks.length + pendingTasks.length;

  const scope =
    filters.projectId === 'all' ? null : filters.projectId === 'none' ? NO_PROJECT_LABEL : (byId.get(filters.projectId)?.name ?? NO_PROJECT_LABEL);

  return {
    from: range.from,
    to: range.to,
    scope,
    generatedAt: now,
    completedCycles: totals.cycles,
    focusSeconds: totals.focusSeconds,
    breakSeconds: totals.breakSeconds,
    interruptedSessions,
    completedTasks,
    pendingTasks,
    completionRate: total === 0 ? 0 : completedTasks.length / total,
    postponedTasks,
    projectGroups: groupByProject(records, tasks, completedTasks, pendingTasks, projects),
    sessions,
  };
}

/** Rapport d'une journée : cas particulier de `buildReport` (tous les projets). */
export function buildDailyReport(log: DayLog, tasks: readonly Task[], now: number = Date.now(), projects: readonly Project[] = []): Report {
  return buildReport({ from: log.date, to: log.date }, { projectId: 'all' }, { logs: { [log.date]: log }, tasks, projects }, now);
}

/** Période lisible : « vendredi 16 octobre 2026 » ou « du lun. 12 oct. au dim. 18 oct. 2026 ». */
export function reportPeriodLabel(report: Pick<Report, 'from' | 'to'>): string {
  if (report.from === report.to) return formatLongDate(report.from);
  return `du ${formatLongDate(report.from)} au ${formatLongDate(report.to)}`;
}

/** Nom affiché d'un groupe : « Projet (client) ». */
export function groupLabel(group: Pick<ProjectReportGroup, 'name' | 'client'>): string {
  return group.client ? `${group.name} (${group.client})` : group.name;
}

/** Échappe les caractères qui casseraient la mise en forme Markdown d'une ligne de liste. */
export function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_[\]<>#|])/g, '\\$1');
}

/** La période atteint le jour de génération : les tâches en cours ont un sens. */
const reachesGenerationDay = (report: Pick<Report, 'to' | 'generatedAt'>) => report.to >= toDateKey(report.generatedAt);
const isSingleDay = (report: Pick<Report, 'from' | 'to'>) => report.from === report.to;

export function reportToMarkdown(report: Report): string {
  const generatedToday = isSingleDay(report) && report.from === toDateKey(report.generatedAt);
  const lines: string[] = [
    `# Rapport FocusDeck — ${reportPeriodLabel(report)}`,
    '',
    generatedToday
      ? `_Généré à ${formatTime(report.generatedAt)}_`
      : `_Généré le ${formatShortDate(toDateKey(report.generatedAt))} à ${formatTime(report.generatedAt)}_`,
    '',
    ...(report.scope === null ? [] : [`_Projet : ${escapeMarkdown(report.scope)}_`, '']),
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

  // Sur plusieurs jours, l'heure seule ne suffit pas : date courte + heure.
  const doneLine = (task: Task) => {
    if (task.completedAt === null) return `- [x] ${escapeMarkdown(task.title)}`;
    const at = isSingleDay(report) ? formatTime(task.completedAt) : `${formatShortDate(toDateKey(task.completedAt))} ${formatTime(task.completedAt)}`;
    return `- [x] ${escapeMarkdown(task.title)} — ${at}`;
  };
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
  taskList(
    (group) => group.completedTasks,
    report.completedTasks,
    doneLine,
    isSingleDay(report) ? '_Aucune tâche complétée aujourd’hui._' : '_Aucune tâche complétée sur la période._',
  );

  if (reachesGenerationDay(report)) {
    lines.push('', `## À reprendre (${report.pendingTasks.length})`, '');
    taskList((group) => group.pendingTasks, report.pendingTasks, pendingLine, '_Rien en attente. Belle journée !_');
  }

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
export function buildHeadline(report: Report): string {
  if (report.completedCycles === 0 && report.completedTasks.length === 0) {
    return reachesGenerationDay(report) && isSingleDay(report)
      ? 'Pas encore de session aujourd’hui — lancez un premier cycle Focus pour démarrer.'
      : 'Aucun cycle ni tâche terminés sur cette période.';
  }
  return `${pluralize(report.completedCycles, 'cycle')} de focus, ${formatDuration(
    report.focusSeconds,
  )} de concentration et ${pluralize(report.completedTasks.length, 'tâche complétée', 'tâches complétées')}.`;
}

export function reportFilename(report: Pick<Report, 'from' | 'to'>, extension: 'md' | 'pdf' | 'csv'): string {
  const period = isSingleDay(report) ? report.from : `${report.from}_${report.to}`;
  return `focusdeck-rapport-${period}.${extension}`;
}

/** Afficher la section « À reprendre » (période qui atteint le jour de génération). */
export const showsPendingTasks = reachesGenerationDay;

const CSV_SEPARATOR = ';';
const CSV_HEADER = ['Date', 'Début', 'Fin', 'Mode', 'Durée (min)', 'Tâche', 'Projet'];
const MODE_LABELS: Record<SessionRecord['mode'], string> = { focus: 'Focus', shortBreak: 'Pause courte', longBreak: 'Pause longue' };

/**
 * Cellule CSV : guillemets si nécessaire, et neutralisation des formules (une valeur saisie
 * par l'utilisateur commençant par `=`, `+`, `-`, `@` serait exécutée par le tableur).
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * Export CSV des sessions (EF-R04) pour Excel en français : séparateur `;`, BOM UTF-8,
 * fins de ligne CRLF, durée en minutes avec virgule décimale.
 */
export function reportToCsv(report: Pick<Report, 'sessions'>): string {
  const rows = report.sessions.map(({ date, session, taskTitle, projectName }) => [
    date,
    formatTime(session.startedAt),
    formatTime(session.endedAt),
    MODE_LABELS[session.mode],
    (Math.round((session.durationSeconds / 60) * 10) / 10).toString().replace('.', ','),
    taskTitle ?? '',
    projectName ?? '',
  ]);
  const lines = [CSV_HEADER, ...rows].map((row) => row.map(csvCell).join(CSV_SEPARATOR));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
