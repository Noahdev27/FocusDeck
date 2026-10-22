import { BarChart3, CalendarDays, Clock, Flame, FolderKanban, Minus, Plus, Target, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FocusBarChart } from '../components/Stats/FocusBarChart';
import { GoalGauge } from '../components/Stats/GoalGauge';
import { ProjectBreakdown } from '../components/Stats/ProjectBreakdown';
import { YearHeatmap } from '../components/Stats/YearHeatmap';
import { StatCard } from '../components/Summary/StatCard';
import { IconButton } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { useFocus } from '../context/FocusContext';
import { aggregate, buildStats, dailyTotals } from '../domain/stats';
import { SETTINGS_LIMITS } from '../utils/constants';
import { cn } from '../utils/cn';
import { formatDuration, formatShortDate, shiftDateKey } from '../utils/format';

const RANGES = [7, 30] as const;
type Range = (typeof RANGES)[number];

export default function StatsPage() {
  const { logs, tasks, projects, today, settings, updateSettings } = useFocus();
  const [range, setRange] = useState<Range>(7);

  // Calcul mémoïsé : seule une session enregistrée (ou un changement de plage) le relance,
  // jamais le tic du minuteur (PERF-4).
  const stats = useMemo(() => buildStats(logs, tasks, projects, today, range), [logs, tasks, projects, today, range]);
  const months = useMemo(() => aggregate(dailyTotals(logs, shiftDateKey(today, -364), today), 'month'), [logs, today]);
  const { summary, streaks } = stats;
  const goal = settings.dailyGoal;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-white">
            <BarChart3 className="size-6 text-violet-300" aria-hidden />
            Statistiques
          </h1>
          <p className="text-sm text-zinc-400">Votre rythme dans la durée, calculé sur l’historique de cet appareil.</p>
        </div>
        <div role="radiogroup" aria-label="Période des statistiques" className="flex rounded-xl bg-black/30 p-1 ring-1 ring-white/[0.06]">
          {RANGES.map((days) => (
            <button
              key={days}
              type="button"
              role="radio"
              aria-checked={range === days}
              onClick={() => setRange(days)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                range === days ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              {days} jours
            </button>
          ))}
        </div>
      </div>

      <section aria-label="Indicateurs" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<Clock className="size-4" />}
          label={`Focus sur ${range} jours`}
          value={formatDuration(summary.focusSeconds)}
          hint={`${summary.cycles} cycle${summary.cycles > 1 ? 's' : ''} terminé${summary.cycles > 1 ? 's' : ''}`}
          accent="#a78bfa"
        />
        <StatCard
          icon={<CalendarDays className="size-4" />}
          label="Moyenne par jour"
          value={formatDuration(summary.averageFocusSeconds)}
          hint={`${summary.activeDays} jour${summary.activeDays > 1 ? 's' : ''} actif${summary.activeDays > 1 ? 's' : ''} sur ${range}`}
          accent="#60a5fa"
        />
        <StatCard
          icon={<Trophy className="size-4" />}
          label="Meilleur jour"
          value={summary.bestDay ? formatDuration(summary.bestDay.focusSeconds) : '—'}
          hint={summary.bestDay ? formatShortDate(summary.bestDay.date) : 'Pas encore de focus'}
          accent="#fbbf24"
        />
        <StatCard
          icon={<Flame className="size-4" />}
          label="Série en cours"
          value={`${streaks.current} j`}
          hint={`Record : ${streaks.longest} jour${streaks.longest > 1 ? 's' : ''}`}
          accent="#fb7185"
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card aria-labelledby="goal-title">
          <CardHeader
            id="goal-title"
            icon={<Target className="size-[18px]" />}
            title="Objectif du jour"
            subtitle="Cycles Focus terminés aujourd’hui."
            actions={
              <div className="flex items-center gap-1">
                <IconButton
                  label="Diminuer l’objectif quotidien"
                  onClick={() => updateSettings({ dailyGoal: goal - 1 })}
                  disabled={goal <= SETTINGS_LIMITS.dailyGoal.min}
                >
                  <Minus className="size-4" />
                </IconButton>
                <IconButton
                  label="Augmenter l’objectif quotidien"
                  onClick={() => updateSettings({ dailyGoal: goal + 1 })}
                  disabled={goal >= SETTINGS_LIMITS.dailyGoal.max}
                >
                  <Plus className="size-4" />
                </IconButton>
              </div>
            }
          />
          <GoalGauge done={stats.today.cycles} goal={goal} />
        </Card>

        <Card aria-labelledby="projects-title">
          <CardHeader
            id="projects-title"
            icon={<FolderKanban className="size-[18px]" />}
            title="Répartition par projet"
            subtitle={`Temps de focus des ${range} derniers jours.`}
          />
          <ProjectBreakdown shares={stats.projects} />
        </Card>
      </div>

      <Card aria-labelledby="daily-title">
        <CardHeader
          id="daily-title"
          icon={<BarChart3 className="size-[18px]" />}
          title="Temps de focus par jour"
          subtitle={`${range} derniers jours`}
        />
        <FocusBarChart days={stats.range} />
      </Card>

      <Card aria-labelledby="year-title">
        <CardHeader id="year-title" icon={<CalendarDays className="size-[18px]" />} title="Une année de focus" subtitle="Chaque case est une journée." />
        <YearHeatmap columns={stats.heatmap} months={months} />
      </Card>
    </>
  );
}
