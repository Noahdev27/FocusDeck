import type { DailyReport, ProjectReportGroup, Task } from '../types';
import { formatDuration, formatLongDate, formatShortDate, formatTime } from './format';
import { buildHeadline, groupLabel, reportFilename } from './report';

const COLORS = {
  ink: [24, 24, 37],
  muted: [110, 110, 130],
  accent: [225, 29, 72],
  violet: [139, 92, 246],
  line: [228, 228, 236],
  success: [16, 185, 129],
} as const satisfies Record<string, readonly [number, number, number]>;

/**
 * Génère le rapport au format PDF et le télécharge. jsPDF est chargé à la
 * demande pour ne pas alourdir le bundle initial.
 */
export async function exportReportPdf(report: DailyReport): Promise<void> {
  const doc = await buildReportPdf(report);
  doc.save(reportFilename(report, 'pdf'));
}

/** Construit le document PDF du rapport sans l'enregistrer (testable). */
export async function buildReportPdf(report: DailyReport): Promise<import('jspdf').jsPDF> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // En-tête avec bandeau dégradé (simulé par deux rectangles).
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 0, pageWidth / 2, 4, 'F');
  doc.setFillColor(...COLORS.violet);
  doc.rect(pageWidth / 2, 0, pageWidth / 2, 4, 'F');

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...COLORS.ink);
  doc.text('Rapport FocusDeck', margin, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.muted);
  doc.text(`${capitalize(formatLongDate(report.date))} · généré à ${formatTime(report.generatedAt)}`, margin, y);
  y += 12;

  // Cartes de statistiques.
  const stats: [string, string][] = [
    ['Cycles', String(report.completedCycles)],
    ['Focus', formatDuration(report.focusSeconds)],
    ['Tâches', String(report.completedTasks.length)],
    ['Complétion', `${Math.round(report.completionRate * 100)} %`],
  ];
  const gap = 4;
  const cardWidth = (contentWidth - gap * (stats.length - 1)) / stats.length;
  stats.forEach(([label, value], index) => {
    const x = margin + index * (cardWidth + gap);
    doc.setDrawColor(...COLORS.line);
    doc.setFillColor(248, 248, 252);
    doc.roundedRect(x, y, cardWidth, 22, 3, 3, 'FD');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(label.toUpperCase(), x + 4, y + 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...COLORS.ink);
    doc.text(value, x + 4, y + 16);
    doc.setFont('helvetica', 'normal');
  });
  y += 30;

  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  doc.text(
    `Temps de pause : ${formatDuration(report.breakSeconds)} · Sessions interrompues : ${report.interruptedSessions}`,
    margin,
    y,
  );
  y += 12;

  const section = (title: string) => {
    ensureSpace(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...COLORS.ink);
    doc.text(title, margin, y);
    y += 3;
    doc.setDrawColor(...COLORS.line);
    doc.line(margin, y, pageWidth - margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
  };

  const bulletList = (items: string[], done: boolean, emptyLabel: string) => {
    if (items.length === 0) {
      doc.setTextColor(...COLORS.muted);
      doc.text(emptyLabel, margin, y);
      y += 10;
      return;
    }
    for (const item of items) {
      const wrapped = doc.splitTextToSize(item, contentWidth - 8) as string[];
      ensureSpace(wrapped.length * 5.5 + 2);
      if (done) {
        doc.setFillColor(...COLORS.success);
        doc.circle(margin + 1.6, y - 1.4, 1.6, 'F');
      } else {
        doc.setDrawColor(...COLORS.muted);
        doc.circle(margin + 1.6, y - 1.4, 1.6, 'S');
      }
      doc.setTextColor(...COLORS.ink);
      doc.text(wrapped, margin + 7, y);
      y += wrapped.length * 5.5 + 1.5;
    }
    y += 6;
  };

  const groups = report.projectGroups;
  if (groups.length > 0) {
    section('Temps par projet');
    for (const group of groups) {
      ensureSpace(8);
      const [r, g, b] = hexToRgb(group.color);
      doc.setFillColor(r, g, b);
      doc.circle(margin + 1.6, y - 1.4, 1.6, 'F');
      doc.setTextColor(...COLORS.ink);
      doc.text(doc.splitTextToSize(groupLabel(group), contentWidth - 70) as string[], margin + 7, y);
      doc.setTextColor(...COLORS.muted);
      doc.text(
        `${formatDuration(group.focusSeconds)} · ${group.completedTasks.length} terminée${group.completedTasks.length > 1 ? 's' : ''}`,
        pageWidth - margin,
        y,
        { align: 'right' },
      );
      y += 7;
    }
    y += 6;
  }

  const completedLabel = (task: Task) => (task.completedAt === null ? task.title : `${task.title}  —  ${formatTime(task.completedAt)}`);
  /** Liste plate, ou sous-titres par projet quand le rapport est groupé. */
  const groupedList = (all: Task[], pick: (group: ProjectReportGroup) => Task[], label: (task: Task) => string, done: boolean, empty: string) => {
    if (groups.length === 0 || all.length === 0) {
      bulletList(all.map(label), done, empty);
      return;
    }
    for (const group of groups) {
      const items = pick(group);
      if (items.length === 0) continue;
      ensureSpace(14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.muted);
      doc.text(group.name.toUpperCase(), margin, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      bulletList(items.map(label), done, empty);
      y -= 3;
    }
    y += 3;
  };

  section(`Tâches complétées (${report.completedTasks.length})`);
  groupedList(report.completedTasks, (group) => group.completedTasks, completedLabel, true, 'Aucune tâche complétée aujourd’hui.');

  section(`À reprendre (${report.pendingTasks.length})`);
  groupedList(report.pendingTasks, (group) => group.pendingTasks, (task) => task.title, false, 'Rien en attente. Belle journée !');

  if (report.postponedTasks.length > 0) {
    section(`Reportées (${report.postponedTasks.length})`);
    bulletList(
      report.postponedTasks.map((task) => (task.plannedFor ? `${task.title}  —  prévue ${formatShortDate(task.plannedFor)}` : task.title)),
      false,
      '',
    );
  }

  ensureSpace(16);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.violet);
  doc.text(doc.splitTextToSize(buildHeadline(report), contentWidth) as string[], margin, y);

  return doc;
}

/** Couleur `#rrggbb` d'un projet en RVB (gris neutre pour « Sans projet »). */
function hexToRgb(hex: string | null): [number, number, number] {
  const match = hex ? /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex) : null;
  if (!match) return [161, 161, 170];
  return [Number.parseInt(match[1] ?? '0', 16), Number.parseInt(match[2] ?? '0', 16), Number.parseInt(match[3] ?? '0', 16)];
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
