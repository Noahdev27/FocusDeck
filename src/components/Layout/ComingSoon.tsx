import { motion } from 'framer-motion';
import { ArrowLeft, Hourglass } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Card } from '../ui/Card';

interface ComingSoonProps {
  title: string;
  description: string;
  icon: ReactNode;
  features: string[];
}

/** État « bientôt disponible » des pages livrées dans un lot ultérieur. */
export function ComingSoon({ title, description, icon, features }: ComingSoonProps) {
  return (
    <Card className="mx-auto w-full max-w-2xl">
      <div className="flex flex-col items-center gap-5 py-6 text-center sm:py-10">
        <motion.span
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          className="grid size-14 place-items-center rounded-2xl bg-white/[0.06] text-violet-300 ring-1 ring-white/10"
        >
          {icon}
        </motion.span>
        <div>
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 px-3 py-1 text-xs font-medium text-violet-200 ring-1 ring-violet-400/20">
            <Hourglass className="size-3.5" aria-hidden /> Bientôt disponible
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">{description}</p>
        </div>
        <ul className="grid w-full max-w-md gap-2 text-left text-sm">
          {features.map((feature, index) => (
            <motion.li
              key={feature}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + index * 0.06 }}
              className="flex items-start gap-3 rounded-xl bg-white/[0.03] px-4 py-3 text-zinc-300 ring-1 ring-white/[0.06]"
            >
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gradient-to-br from-rose-400 to-violet-400" />
              {feature}
            </motion.li>
          ))}
        </ul>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-zinc-100 ring-1 ring-white/10 transition hover:bg-white/[0.1]"
        >
          <ArrowLeft className="size-4" aria-hidden /> Retour au tableau de bord
        </Link>
      </div>
    </Card>
  );
}
