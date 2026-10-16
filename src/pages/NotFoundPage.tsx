import { Compass } from 'lucide-react';
import { Link } from 'react-router';
import { Card } from '../components/ui/Card';

export default function NotFoundPage() {
  return (
    <Card className="mx-auto w-full max-w-lg">
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <Compass className="size-8 text-violet-300" aria-hidden />
        <h1 className="text-xl font-semibold text-white">Page introuvable</h1>
        <p className="text-sm text-zinc-400">Cette adresse ne correspond à aucune page de FocusDeck.</p>
        <Link to="/" className="rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-zinc-100 ring-1 ring-white/10 hover:bg-white/[0.1]">
          Retour au tableau de bord
        </Link>
      </div>
    </Card>
  );
}
