import { CheckCircle2, Clock, Coffee, FileText, Flame, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useFocus } from '../../context/FocusContext';
import { buildDailyReport } from '../../utils/report';
import { formatDuration } from '../../utils/format';
import { Button, IconButton } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { ReportDialog } from './ReportDialog';
import { SessionTimeline } from './SessionTimeline';
import { StatCard } from './StatCard';

export function DailySummary() {
  const { todayLog, tasks, clearTodayLog } = useFocus();
  // Horodatage de génération, fixé à l'ouverture de la boîte de dialogue du rapport.
  const [reportOpenedAt, setReportOpenedAt] = useState<number | null>(null);
  const report = useMemo(
    () => buildDailyReport(todayLog, tasks, reportOpenedAt ?? undefined),
    [todayLog, tasks, reportOpenedAt],
  );

  return (
    <Card aria-labelledby="summary-title">
      <CardHeader
        id="summary-title"
        icon={<FileText className="size-[18px]" />}
        title="Activité du jour"
        subtitle="Suivez votre rythme et exportez votre rapport de fin de journée."
        actions={
          <>
            {todayLog.sessions.length > 0 && (
              <IconButton
                label="Effacer l'historique du jour"
                onClick={() => {
                  if (window.confirm('Effacer toutes les sessions enregistrées aujourd’hui ?')) clearTodayLog();
                }}
              >
                <Trash2 className="size-4" />
              </IconButton>
            )}
            <Button variant="primary" icon={<FileText className="size-4" />} onClick={() => setReportOpenedAt(Date.now())}>
              <span className="hidden sm:inline">Générer le rapport</span>
              <span className="sm:hidden">Rapport</span>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<Flame className="size-4" />}
          label="Cycles terminés"
          value={String(report.completedCycles)}
          hint={report.interruptedSessions > 0 ? `${report.interruptedSessions} interrompu(s)` : 'Pomodoros complets'}
          accent="#fb7185"
        />
        <StatCard
          icon={<Clock className="size-4" />}
          label="Temps de focus"
          value={formatDuration(report.focusSeconds)}
          hint="Temps total concentré"
          accent="#a855f7"
        />
        <StatCard
          icon={<CheckCircle2 className="size-4" />}
          label="Tâches complétées"
          value={String(report.completedTasks.length)}
          hint={`${Math.round(report.completionRate * 100)} % de complétion`}
          accent="#34d399"
        />
        <StatCard
          icon={<Coffee className="size-4" />}
          label="Temps de pause"
          value={formatDuration(report.breakSeconds)}
          hint="Récupération"
          accent="#60a5fa"
        />
      </div>

      <div className="mt-5">
        <SessionTimeline sessions={todayLog.sessions} />
      </div>

      <ReportDialog open={reportOpenedAt !== null} onClose={() => setReportOpenedAt(null)} report={report} />
    </Card>
  );
}
