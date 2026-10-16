import { createContext, useContext, useState, type ReactNode } from 'react';
import { createLocalRepository } from './localRepository';
import type { FocusRepository } from './repository';

const RepositoryContext = createContext<FocusRepository | null>(null);

/** Injecte l'implémentation de persistance (locale par défaut). */
export function RepositoryProvider({ repository, children }: { repository?: FocusRepository; children: ReactNode }) {
  const [value] = useState(() => repository ?? createLocalRepository());
  return <RepositoryContext.Provider value={value}>{children}</RepositoryContext.Provider>;
}

export function useRepository(): FocusRepository {
  const repository = useContext(RepositoryContext);
  if (!repository) throw new Error('useRepository doit être utilisé dans un <RepositoryProvider>.');
  return repository;
}
