import { FileText } from 'lucide-react';
import { ComingSoon } from '../components/Layout/ComingSoon';

export default function ReportsPage() {
  return (
    <ComingSoon
      title="Rapports"
      icon={<FileText className="size-6" />}
      description="Le rapport du jour reste disponible depuis le tableau de bord, section « Activité du jour »."
      features={[
        'Rapports sur une semaine, un mois ou une période libre',
        'Filtre par projet et par client',
        'Export Markdown, PDF et CSV',
      ]}
    />
  );
}
