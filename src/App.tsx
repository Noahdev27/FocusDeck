import { MotionConfig } from 'framer-motion';
import { FocusProvider } from './context/FocusContext';
import { TimerProvider } from './context/TimerContext';
import { AppShell } from './components/Layout/AppShell';
import { PomodoroTimer } from './components/Pomodoro/PomodoroTimer';
import { TaskBoard } from './components/Todo/TaskBoard';
import { DailySummary } from './components/Summary/DailySummary';

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <FocusProvider>
        <TimerProvider>
          <AppShell>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <PomodoroTimer />
              <TaskBoard />
            </div>
            <DailySummary />
          </AppShell>
        </TimerProvider>
      </FocusProvider>
    </MotionConfig>
  );
}
