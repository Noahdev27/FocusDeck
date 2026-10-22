import { CheckCircle2, Clock, Coffee, FileText, Flame, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useFocus } from '../../context/FocusContext';
import { buildDailyReport, groupLabel } from '../../utils/report';
import { formatDuration } from '../../utils/format';
import { Button, IconButton } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { GoalGauge } from '../Stats/GoalGauge';
import { ReportDialog } from './ReportDialog';
import { SessionTimeline } from './SessionTimeline';
import { StatCard } from './StatCard';

export function DailySummary() {
  const { todayLog, tasks, projects, settings, clearTodayLog } = useFocus();
  // Horodatage de génération, fixé à l'ouverture de la boîte de dialogue du rapport.
  const [reportOpenedAt, setReportOpenedAt] = useState<number | null>(null);
  const report = useMemo(
    () => buildDailyReport(todayLog, tasks, reportOpenedAt ?? undefined, projects),
    [todayLog, tasks, reportOpenedAt, projects],
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

      <section aria-label="Objectif du jour" className="mt-5 max-w-md">
        <GoalGauge done={report.completedCycles} goal={settings.dailyGoal} compact />
      </section>

      {report.projectGroups.length > 0 && (
        <section aria-label="Temps par projet" className="mt-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Temps par projet</h3>
          <ul className="flex flex-wrap gap-2">
            {report.projectGroups.map((group) => (
              <li
                key={group.projectId ?? 'none'}
                className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-1.5 text-sm ring-1 ring-white/[0.06]"
              >
                <span aria-hidden className="size-2 rounded-full bg-zinc-500" style={group.color ? { backgroundColor: group.color } : undefined} />
                <span className="text-zinc-200">{groupLabel(group)}</span>
                <span className="font-mono text-xs tabular-nums text-zinc-400">{formatDuration(group.focusSeconds)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-5">
        <SessionTimeline sessions={todayLog.sessions} />
      </div>

      <ReportDialog open={reportOpenedAt !== null} onClose={() => setReportOpenedAt(null)} report={report} />
    </Card>
  );
}
