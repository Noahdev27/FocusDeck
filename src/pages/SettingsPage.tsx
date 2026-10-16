import { RotateCcw, Settings2 } from 'lucide-react';
import { SettingsForm } from '../components/Pomodoro/SettingsForm';
import { useFocus } from '../context/FocusContext';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';

export default function SettingsPage() {
  const { resetSettings } = useFocus();
  return (
    <Card as="section" aria-labelledby="settings-title" className="mx-auto w-full max-w-2xl">
      <CardHeader
        id="settings-title"
        icon={<Settings2 className="size-[18px]" />}
        title="Réglages"
        subtitle="Les durées s'appliquent immédiatement à une phase non démarrée."
        actions={
          <Button variant="ghost" size="sm" icon={<RotateCcw className="size-4" />} onClick={resetSettings}>
            Valeurs par défaut
          </Button>
        }
      />
      <SettingsForm />
    </Card>
  );
}
