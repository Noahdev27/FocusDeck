import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

const reportError = vi.fn();
vi.mock('../../observability', () => ({ reportError: (error: unknown) => reportError(error) }));

function Broken(): never {
  throw new Error('rendu impossible');
}

describe('ErrorBoundary', () => {
  it('affiche un écran de reprise et signale l’erreur', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Oups');
    expect(screen.getByRole('button', { name: 'Recharger' })).toBeInTheDocument();
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: 'rendu impossible' }));
  });

  it('affiche les enfants en temps normal', () => {
    render(
      <ErrorBoundary>
        <p>Contenu</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Contenu')).toBeInTheDocument();
  });
});
