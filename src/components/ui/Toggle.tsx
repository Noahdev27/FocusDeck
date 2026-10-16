import { motion } from 'framer-motion';
import { useId, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: ReactNode;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, description, disabled = false }: ToggleProps) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-zinc-200">
          {label}
        </label>
        {description && <p className="text-xs text-zinc-400">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-40',
          checked ? 'justify-end bg-gradient-to-r from-rose-500 to-violet-500' : 'justify-start bg-white/10',
        )}
      >
        <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 35 }} className="size-5 rounded-full bg-white shadow" />
      </button>
    </div>
  );
}
