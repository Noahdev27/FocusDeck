import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'section' | 'div' | 'article';
}

export function Card({ as: Tag = 'section', className, ...props }: CardProps) {
  return <Tag className={cn('glass p-5 sm:p-6', className)} {...props} />;
}

interface CardHeaderProps {
  icon?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  id?: string;
}

export function CardHeader({ icon, title, subtitle, actions, id }: CardHeaderProps) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 flex-1 basis-40 items-center gap-3">
        {icon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-zinc-300 ring-1 ring-white/10">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 id={id} className="text-base font-semibold tracking-tight text-white">
            {title}
          </h2>
          {subtitle && <p className="text-sm text-zinc-400">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </header>
  );
}
