import { BarChart3 } from 'lucide-react';
import { ComingSoon } from '../components/Layout/ComingSoon';

export default function StatsPage() {
  return (
    <ComingSoon
      title="Statistiques"
      icon={<BarChart3 className="size-6" />}
      description="Suivez votre rythme dans la durée : votre historique de sessions est déjà enregistré."
      features={[
        'Temps de focus par jour sur 7 et 30 jours',
        'Carte de chaleur annuelle et série de jours consécutifs',
        'Objectif quotidien de cycles avec jauge',
        'Répartition du temps par projet',
      ]}
    />
  );
}
