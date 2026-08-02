/**
 * Top-level error boundary.
 *
 * A render error anywhere in the game surfaces here as an explicit, honest
 * failure screen with the real message and a way to recover. Errors are never
 * hidden behind a placeholder success state.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[app] unrecoverable render error', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="state-block" role="alert">
        <h1 className="state-block__title">The game hit an unexpected error</h1>
        <p className="state-block__body">
          Something went wrong while drawing this screen, and the game stopped rather than continuing in
          an unknown state. Reloading usually clears it. Your saved progress has not been deleted.
        </p>
        <pre
          className="subtle"
          style={{
            maxWidth: '46rem',
            overflowX: 'auto',
            textAlign: 'left',
            padding: 'var(--space-3)',
            background: 'var(--colour-bg-elevated)',
            border: '1px solid var(--colour-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {error.message}
        </pre>
        <button className="button button--primary" type="button" onClick={() => window.location.reload()}>
          Reload the game
        </button>
      </div>
    );
  }
}
