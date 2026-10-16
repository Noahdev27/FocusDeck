import type { DailyReport } from '../types';
import { formatDuration, formatLongDate, formatTime } from './format';
import { buildHeadline, reportFilename } from './report';

const COLORS = {
  ink: [24, 24, 37],
  muted: [110, 110, 130],
  accent: [225, 29, 72],
  violet: [139, 92, 246],
  line: [228, 228, 236],
  success: [16, 185, 129],
} as const satisfies Record<string, readonly [number, number, number]>;

/**
 * Génère le rapport au format PDF. jsPDF est chargé à la demande pour ne pas
 * alourdir le bundle initial.
 */
export async function exportReportPdf(report: DailyReport): Promise<void> {
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

  section(`Tâches complétées (${report.completedTasks.length})`);
  bulletList(
    report.completedTasks.map((task) =>
      task.completedAt === null ? task.title : `${task.title}  —  ${formatTime(task.completedAt)}`,
    ),
    true,
    'Aucune tâche complétée aujourd’hui.',
  );

  section(`À reprendre (${report.pendingTasks.length})`);
  bulletList(
    report.pendingTasks.map((task) => task.title),
    false,
    'Rien en attente. Belle journée !',
  );

  ensureSpace(16);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.violet);
  doc.text(doc.splitTextToSize(buildHeadline(report), contentWidth) as string[], margin, y);

  doc.save(reportFilename(report, 'pdf'));
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
