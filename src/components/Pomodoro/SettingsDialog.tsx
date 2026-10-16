import { Minus, Plus, RotateCcw, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { useFocus } from '../../context/FocusContext';
import type { TimerSettings } from '../../types';
import { SETTINGS_LIMITS } from '../../utils/constants';
import { notificationsSupported, requestNotificationPermission } from '../../utils/notify';
import { playChime, unlockAudio } from '../../utils/sound';
import { Button, IconButton } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Toggle } from '../ui/Toggle';

type NumericKey = 'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes' | 'longBreakInterval';

const NUMERIC_FIELDS: { key: NumericKey; label: string; unit: string }[] = [
  { key: 'focusMinutes', label: 'Focus', unit: 'min' },
  { key: 'shortBreakMinutes', label: 'Pause courte', unit: 'min' },
  { key: 'longBreakMinutes', label: 'Pause longue', unit: 'min' },
  { key: 'longBreakInterval', label: 'Pause longue après', unit: 'cycles' },
];

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, updateSettings, resetSettings } = useFocus();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    notificationsSupported() ? Notification.permission : 'unsupported',
  );

  const onNotificationsChange = async (enabled: boolean) => {
    if (!enabled) {
      updateSettings({ notificationsEnabled: false });
      return;
    }
    const result = await requestNotificationPermission();
    setPermission(result);
    updateSettings({ notificationsEnabled: result === 'granted' });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Réglages du minuteur"
      description="Les durées s'appliquent immédiatement à une phase non démarrée."
      footer={
        <>
          <Button variant="ghost" icon={<RotateCcw className="size-4" />} onClick={resetSettings} className="mr-auto">
            Valeurs par défaut
          </Button>
          <Button variant="primary" onClick={onClose}>
            Terminé
          </Button>
        </>
      }
    >
      <section aria-label="Durées" className="grid grid-cols-2 gap-3">
        {NUMERIC_FIELDS.map((field) => (
          <NumberStepper
            key={field.key}
            label={field.label}
            unit={field.unit}
            value={settings[field.key]}
            min={SETTINGS_LIMITS[field.key].min}
            max={SETTINGS_LIMITS[field.key].max}
            onChange={(value) => updateSettings({ [field.key]: value } as Partial<TimerSettings>)}
          />
        ))}
      </section>

      <section aria-label="Automatisation" className="mt-6 divide-y divide-white/[0.06]">
        <Toggle
          label="Démarrer les pauses automatiquement"
          checked={settings.autoStartBreaks}
          onChange={(autoStartBreaks) => updateSettings({ autoStartBreaks })}
        />
        <Toggle
          label="Relancer le focus automatiquement"
          checked={settings.autoStartFocus}
          onChange={(autoStartFocus) => updateSettings({ autoStartFocus })}
        />
      </section>

      <section aria-label="Alertes" className="mt-6 divide-y divide-white/[0.06]">
        <Toggle
          label="Alerte sonore"
          description="Carillon synthétisé à la fin de chaque phase."
          checked={settings.soundEnabled}
          onChange={(soundEnabled) => updateSettings({ soundEnabled })}
        />
        <div className="flex items-center gap-3 py-3">
          <Volume2 className="size-4 text-zinc-400" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            disabled={!settings.soundEnabled}
            onChange={(event) => updateSettings({ volume: Number(event.target.value) })}
            aria-label="Volume"
            className="flex-1 disabled:opacity-40"
          />
          <Button
            size="sm"
            disabled={!settings.soundEnabled}
            onClick={() => {
              unlockAudio();
              playChime('focus', settings.volume);
            }}
          >
            Tester
          </Button>
        </div>
        <Toggle
          label="Notifications du navigateur"
          description={
            permission === 'unsupported'
              ? 'Non prises en charge par ce navigateur.'
              : permission === 'denied'
                ? 'Bloquées : autorisez-les dans les paramètres du site.'
                : 'Utile quand l’onglet est en arrière-plan.'
          }
          checked={settings.notificationsEnabled && permission === 'granted'}
          disabled={permission === 'unsupported' || permission === 'denied'}
          onChange={(enabled) => void onNotificationsChange(enabled)}
        />
      </section>
    </Modal>
  );
}

interface NumberStepperProps {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

function NumberStepper({ label, unit, value, min, max, onChange }: NumberStepperProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, parsed)));
    setDraft(null);
  };

  return (
    <div className="rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/[0.06]">
      <p className="text-xs font-medium text-zinc-400">{label}</p>
      <div className="mt-2 flex items-center justify-between gap-1">
        <IconButton label={`Diminuer ${label}`} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} className="size-8">
          <Minus className="size-4" />
        </IconButton>
        <div className="flex items-baseline gap-1">
          <input
            aria-label={`${label} (${unit})`}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={draft ?? value}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={(event) => commit(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit(event.currentTarget.value);
            }}
            className="w-12 appearance-none bg-transparent text-center font-mono text-xl font-semibold tabular-nums text-white outline-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span aria-hidden className="text-xs text-zinc-400">
            {unit}
          </span>
        </div>
        <IconButton label={`Augmenter ${label}`} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className="size-8">
          <Plus className="size-4" />
        </IconButton>
      </div>
    </div>
  );
}
