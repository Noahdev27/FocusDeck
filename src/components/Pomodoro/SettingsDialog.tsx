import { RotateCcw } from 'lucide-react';
import { useFocus } from '../../context/FocusContext';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { SettingsForm } from './SettingsForm';

/** Accès rapide aux réglages depuis n'importe quelle page (bouton d'en-tête, raccourci « , »). */
export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { resetSettings } = useFocus();
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
      <SettingsForm />
    </Modal>
  );
}
