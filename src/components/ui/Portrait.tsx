/**
 * Fighter portrait.
 *
 * Renders the artwork configured on `fighter.portraitAsset` when there is any,
 * and falls back to a generated placeholder otherwise — or if the image fails
 * to load, so a missing file degrades to a labelled placeholder rather than a
 * browser broken-image icon.
 *
 * Asset paths are stored relative (no leading slash) and resolved here against
 * `import.meta.env.BASE_URL`, so the same record works in development, in the
 * production build and under a non-root deployment path.
 */

import { useState } from 'react';
import type { Fighter } from '../../types/fighter.ts';

export interface PortraitProps {
  readonly fighter: Fighter;
  /** Hides the caption, for dense list contexts. */
  readonly compact?: boolean;
}

/** Resolves a stored asset path against the deployment base path. */
export function resolveAssetUrl(path: string): string {
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path;
  const base = import.meta.env.BASE_URL ?? '/';
  const normalisedBase = base.endsWith('/') ? base : `${base}/`;
  const normalisedPath = path.startsWith('/') ? path.slice(1) : path;
  return `${normalisedBase}${normalisedPath}`;
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
          src={resolveAssetUrl(fighter.portraitAsset ?? '')}
          alt={fighter.artwork.altText ?? `${fighter.name}, ${fighter.role}`}
          onError={() => setFailed(true)}
          loading="lazy"
          decoding="async"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
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
