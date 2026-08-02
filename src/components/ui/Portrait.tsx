/**
 * Fighter portrait.
 *
 * Renders `fighter.portraitAsset` when one is configured. Stage 1 configures
 * none, so every fighter falls back to a generated placeholder built from the
 * fighter's initials and their configured gi colours. If a portrait path IS
 * configured but fails to load, the same placeholder is shown rather than a
 * browser broken-image icon.
 */

import { useState } from 'react';
import type { Fighter } from '../../types/fighter.ts';

export interface PortraitProps {
  readonly fighter: Fighter;
  /** Hides the "placeholder art" caption, for dense list contexts. */
  readonly compact?: boolean;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function Portrait({ fighter, compact = false }: PortraitProps) {
  const [failed, setFailed] = useState(false);
  const showImage = fighter.portraitAsset !== null && !failed;

  return (
    <div
      className="portrait"
      style={{
        background: showImage
          ? undefined
          : `linear-gradient(160deg, ${fighter.animation.accentColour}33, #0e131c)`,
      }}
    >
      {showImage ? (
        <img
          src={fighter.portraitAsset ?? ''}
          alt={`${fighter.name}, ${fighter.role}`}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <>
          <span
            className="portrait__initials"
            role="img"
            aria-label={`${fighter.name} — placeholder portrait`}
          >
            {initialsOf(fighter.name)}
          </span>
          {compact ? null : <span className="portrait__note">Placeholder art</span>}
        </>
      )}
    </div>
  );
}
