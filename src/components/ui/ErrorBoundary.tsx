import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../../observability';

interface ErrorBoundaryState {
  failed: boolean;
}

/** Filet de sécurité : une erreur de rendu affiche un écran de reprise au lieu d'une page blanche. */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(Object.assign(error, { componentStack: info.componentStack }));
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-semibold text-white">Oups, quelque chose s’est mal passé.</h1>
        <p className="text-sm text-zinc-400">
          Vos données sont enregistrées dans votre navigateur et n’ont pas été perdues. Rechargez la page pour reprendre.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl bg-gradient-to-r from-rose-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Recharger
        </button>
      </div>
    );
  }
}
