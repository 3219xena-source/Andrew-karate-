/**
 * Shared screen chrome: skip link, header, main region and optional footer.
 *
 * Every screen uses this so the sound toggle, the settings entry point and the
 * "skip to content" link appear in the same place throughout the game, and so
 * that each screen has exactly one `<main>` landmark.
 */

import type { ReactNode } from 'react';
import { useGameStore } from '../../state/gameStore.ts';
import { AudioButton } from './AudioButton.tsx';
import { Button } from './Button.tsx';

export interface ScreenFrameProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  /** Extra controls placed left of the settings and sound buttons. */
  readonly actions?: ReactNode;
  /** Removes the body's max width, for the map and dojo. */
  readonly wide?: boolean;
  readonly showSettings?: boolean;
}

export function ScreenFrame({
  eyebrow,
  title,
  children,
  footer,
  actions,
  wide = false,
  showSettings = true,
}: ScreenFrameProps) {
  const openSettings = useGameStore((state) => state.openSettings);

  return (
    <div className="screen">
      <a className="skip-link" href="#screen-content">
        Skip to content
      </a>
      <header className="screen__header">
        <div className="screen__header-titles">
          <span className="screen__eyebrow">{eyebrow}</span>
          <h1 className="screen__title">{title}</h1>
        </div>
        <div className="screen__header-actions">
          {actions}
          {showSettings ? (
            <Button size="icon" variant="ghost" onClick={openSettings} title="Open settings">
              <span aria-hidden="true">⚙</span>
              <span className="visually-hidden">Settings</span>
            </Button>
          ) : null}
          <AudioButton />
        </div>
      </header>
      <main id="screen-content" className={`screen__body${wide ? ' screen__body--wide' : ''}`} tabIndex={-1}>
        {children}
      </main>
      {footer ? <footer className="screen__footer">{footer}</footer> : null}
    </div>
  );
}
