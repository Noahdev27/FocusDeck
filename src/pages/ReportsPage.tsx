import { Check, ChevronLeft, ChevronRight, Copy, FileDown, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MarkdownPreview } from '../components/Summary/MarkdownPreview';
import { StatCard } from '../components/Summary/StatCard';
import { Button, IconButton } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useFocus } from '../context/FocusContext';
import { customPeriod, periodFor, periodLabel, shiftPeriod, type Period, type PeriodKind } from '../domain/periods';
import { reportError, trackEvent } from '../observability';
import { cn } from '../utils/cn';
import { downloadText } from '../utils/download';
import { formatDuration } from '../utils/format';
import { exportReportPdf } from '../utils/pdf';
import { buildReport, reportFilename, reportToCsv, reportToMarkdown } from '../utils/report';
import { isDateKey } from '../utils/validation';

const KINDS: { id: PeriodKind; label: string }[] = [
  { id: 'day', label: 'Jour' },
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
  { id: 'custom', label: 'Plage libre' },
];

/** Rapports de période (EF-R02) : sélecteur, filtre projet, aperçu, export Markdown/PDF/CSV. */
export default function ReportsPage() {
  const { logs, tasks, projects, today } = useFocus();
  const [period, setPeriod] = useState<Period>(() => periodFor('week', today));
  const [projectId, setProjectId] = useState('all');
  const [generatedAt] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const report = useMemo(
    () => buildReport({ from: period.from, to: period.to }, { projectId }, { logs, tasks, projects }, generatedAt),
    [period, projectId, logs, tasks, projects, generatedAt],
  );
  const markdown = useMemo(() => reportToMarkdown(report), [report]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  const selectKind = (kind: PeriodKind) =>
    setPeriod((current) => (kind === 'custom' ? { ...current, kind } : periodFor(kind, current.kind === 'custom' ? current.to : current.from)));

  const exportMarkdown = () => {
    downloadText(markdown, reportFilename(report, 'md'), 'text/markdown');
    trackEvent({ name: 'report_exported', properties: { format: 'markdown' } });
  };
  const exportCsv = () => {
    downloadText(reportToCsv(report), reportFilename(report, 'csv'), 'text/csv');
    trackEvent({ name: 'report_exported', properties: { format: 'csv' } });
  };
  const exportPdf = async () => {
    if (exporting) return;
    setError(null);
    setExporting(true);
    try {
      await exportReportPdf(report);
      trackEvent({ name: 'report_exported', properties: { format: 'pdf' } });
    } catch (cause) {
      console.error(cause);
      reportError(cause);
      setError('La génération du PDF a échoué. Réessayez ou exportez en Markdown.');
    } finally {
      setExporting(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
    } catch {
      setError('Impossible de copier dans le presse-papiers.');
    }
  };

  const fieldClass = 'h-9 rounded-lg bg-ink-800 px-2 text-sm text-zinc-100 ring-1 ring-white/10';

  return (
    <>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-white">
          <FileText className="size-6 text-violet-300" aria-hidden />
          Rapports
        </h1>
        <p className="text-sm text-zinc-400">Un bilan par jour, semaine, mois ou période libre, prêt à envoyer à un client.</p>
      </div>

      <Card as="section" aria-label="Période et filtres" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div role="radiogroup" aria-label="Type de période" className="flex rounded-xl bg-black/30 p-1 ring-1 ring-white/[0.06]">
            {KINDS.map((kind) => (
              <button
                key={kind.id}
                type="button"
                role="radio"
                aria-checked={period.kind === kind.id}
                onClick={() => selectKind(kind.id)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  period.kind === kind.id ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-zinc-200',
                )}
              >
                {kind.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            Projet
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className={cn(fieldClass, 'max-w-48')}>
              <option value="all">Tous les projets</option>
              <option value="none">Sans projet</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.archivedAt === null ? project.name : `${project.name} (archivé)`}
                </option>
              ))}
            </select>
          </label>
        </div>

        {period.kind === 'custom' ? (
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
            <label className="flex items-center gap-2">
              Du
              <input
                type="date"
                value={period.from}
                max={today}
                onChange={(event) => isDateKey(event.target.value) && setPeriod(customPeriod(event.target.value, period.to))}
                className={fieldClass}
              />
            </label>
            <label className="flex items-center gap-2">
              Au
              <input
                type="date"
                value={period.to}
                max={today}
                onChange={(event) => isDateKey(event.target.value) && setPeriod(customPeriod(period.from, event.target.value))}
                className={fieldClass}
              />
            </label>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <IconButton label="Période précédente" onClick={() => setPeriod(shiftPeriod(period, -1))}>
              <ChevronLeft className="size-4" />
            </IconButton>
            <p aria-live="polite" className="min-w-0 flex-1 text-center text-sm font-medium text-zinc-100 first-letter:uppercase sm:flex-none sm:px-2">
              {periodLabel(period)}
            </p>
            <IconButton label="Période suivante" onClick={() => setPeriod(shiftPeriod(period, 1))} disabled={period.to >= today}>
              <ChevronRight className="size-4" />
            </IconButton>
            <Button size="sm" variant="ghost" onClick={() => setPeriod(periodFor(period.kind === 'custom' ? 'week' : period.kind, today))}>
              Aujourd’hui
            </Button>
          </div>
        )}
      </Card>

      <section aria-label="Résumé de la période" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<FileText className="size-4" />} label="Temps de focus" value={formatDuration(report.focusSeconds)} accent="#a78bfa" />
        <StatCard icon={<FileText className="size-4" />} label="Cycles terminés" value={String(report.completedCycles)} accent="#fb7185" />
        <StatCard icon={<FileText className="size-4" />} label="Tâches complétées" value={String(report.completedTasks.length)} accent="#34d399" />
        <StatCard icon={<FileText className="size-4" />} label="Sessions" value={String(report.sessions.length)} accent="#60a5fa" />
      </section>

      <Card as="section" aria-labelledby="report-preview-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="report-preview-title" className="text-base font-semibold tracking-tight text-white">
            Aperçu
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void copy()} icon={copied ? <Check className="size-4 text-emerald-300" /> : <Copy className="size-4" />}>
              {copied ? 'Copié' : 'Copier'}
            </Button>
            <Button size="sm" onClick={exportMarkdown} icon={<FileText className="size-4" />}>
              Markdown
            </Button>
            <Button
              size="sm"
              onClick={() => void exportPdf()}
              aria-busy={exporting}
              icon={exporting ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
            >
              PDF
            </Button>
            <Button size="sm" variant="primary" onClick={exportCsv} icon={<FileSpreadsheet className="size-4" />}>
              CSV des sessions
            </Button>
          </div>
        </div>
        {error && (
          <p role="alert" className="mb-3 text-sm text-rose-300">
            {error}
          </p>
        )}
        <div className="rounded-2xl bg-black/30 p-5 ring-1 ring-white/[0.06]">
          <MarkdownPreview markdown={markdown} />
        </div>
      </Card>
    </>
  );
}
