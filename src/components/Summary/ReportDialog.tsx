import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, FileDown, FileText, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { DailyReport, ReportFormat } from '../../types';
import { downloadText } from '../../utils/download';
import { exportReportPdf } from '../../utils/pdf';
import { reportFilename, reportToMarkdown } from '../../utils/report';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { MarkdownPreview } from './MarkdownPreview';

interface ReportDialogProps {
  open: boolean;
  onClose: () => void;
  report: DailyReport;
}

type CopyState = 'idle' | 'copied' | 'error';

export function ReportDialog({ open, onClose, report }: ReportDialogProps) {
  const [format, setFormat] = useState<ReportFormat>('markdown');
  const [view, setView] = useState<'preview' | 'source'>('preview');
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markdown = useMemo(() => reportToMarkdown(report), [report]);

  useEffect(() => {
    if (copyState === 'idle') return;
    const id = window.setTimeout(() => setCopyState('idle'), 2000);
    return () => window.clearTimeout(id);
  }, [copyState]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  };

  const download = async () => {
    if (exporting) return;
    setError(null);
    if (format === 'markdown') {
      downloadText(markdown, reportFilename(report, 'md'), 'text/markdown');
      return;
    }
    setExporting(true);
    try {
      await exportReportPdf(report);
    } catch (cause) {
      console.error(cause);
      setError('La génération du PDF a échoué. Réessayez ou exportez en Markdown.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Rapport de fin de journée"
      description="Aperçu du résumé structuré, prêt à être exporté."
      footer={
        <>
          <div role="radiogroup" aria-label="Format d'export" className="mr-auto flex rounded-xl bg-black/30 p-1 ring-1 ring-white/[0.06]">
            {(['markdown', 'pdf'] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={format === item}
                onClick={() => setFormat(item)}
                className={cn(
                  'relative rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors',
                  format === item ? 'text-white' : 'text-zinc-400 hover:text-zinc-300',
                )}
              >
                {format === item && <motion.span layoutId="format-pill" className="absolute inset-0 rounded-lg bg-white/10" />}
                <span className="relative">{item === 'markdown' ? 'Markdown' : 'PDF'}</span>
              </button>
            ))}
          </div>
          <Button
            onClick={() => void copy()}
            icon={copyState === 'copied' ? <Check className="size-4 text-emerald-300" /> : <Copy className="size-4" />}
          >
            {copyState === 'copied' ? 'Copié' : copyState === 'error' ? 'Échec' : 'Copier'}
          </Button>
          <Button
            variant="primary"
            onClick={() => void download()}
            // Pas de `disabled` : le bouton garderait sinon le focus clavier perdu pendant l'export.
            aria-busy={exporting}
            icon={
              exporting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : format === 'pdf' ? (
                <FileDown className="size-4" />
              ) : (
                <FileText className="size-4" />
              )
            }
          >
            Télécharger .{format === 'pdf' ? 'pdf' : 'md'}
          </Button>
        </>
      }
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-1 text-xs">
          {(['preview', 'source'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              aria-pressed={view === item}
              className={cn(
                'rounded-lg px-2.5 py-1.5 font-medium transition-colors',
                view === item ? 'bg-white/[0.07] text-white' : 'text-zinc-400 hover:text-zinc-300',
              )}
            >
              {item === 'preview' ? 'Aperçu' : 'Source Markdown'}
            </button>
          ))}
        </div>
        <span className="font-mono text-[11px] text-zinc-400">{reportFilename(report, format === 'pdf' ? 'pdf' : 'md')}</span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className="rounded-2xl bg-black/30 p-5 ring-1 ring-white/[0.06]"
        >
          {view === 'preview' ? (
            <MarkdownPreview markdown={markdown} />
          ) : (
            <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-300">{markdown}</pre>
          )}
        </motion.div>
      </AnimatePresence>

      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-300">
          {error}
        </p>
      )}
    </Modal>
  );
}
