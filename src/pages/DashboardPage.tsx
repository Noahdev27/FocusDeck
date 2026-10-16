import { PomodoroTimer } from '../components/Pomodoro/PomodoroTimer';
import { DailySummary } from '../components/Summary/DailySummary';
import { TaskBoard } from '../components/Todo/TaskBoard';

export default function DashboardPage() {
  return (
    <>
      <h1 className="sr-only">Tableau de bord</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <PomodoroTimer />
        <TaskBoard />
      </div>
      <DailySummary />
    </>
  );
}
