import { useEffect, useState } from 'react';
import { toDateKey } from '../utils/format';

/** Clé du jour courant (`YYYY-MM-DD`), mise à jour automatiquement à minuit. */
export function useToday(): string {
  const [today, setToday] = useState(() => toDateKey(Date.now()));

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const id = window.setTimeout(() => setToday(toDateKey(Date.now())), nextMidnight.getTime() - now.getTime() + 50);
    return () => window.clearTimeout(id);
  }, [today]);

  return today;
}
