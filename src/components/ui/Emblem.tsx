/**
 * Team emblem placeholder.
 *
 * Stage 1 has no commissioned club logos. Rather than a broken image or an
 * empty box, each club renders a coloured glyph built from its own palette, and
 * the component is labelled as a placeholder for assistive technology.
 */

import type { Team } from '../../types/team.ts';

export interface EmblemProps {
  readonly team: Team;
  readonly size?: 'default' | 'large';
}

export function Emblem({ team, size = 'default' }: EmblemProps) {
  return (
    <div
      className={`emblem${size === 'large' ? ' emblem--large' : ''}`}
      style={{
        background: `linear-gradient(150deg, ${team.emblem.primary}, ${team.emblem.secondary})`,
        color: '#ffffff',
      }}
      role="img"
      aria-label={`${team.name} emblem (placeholder artwork)`}
    >
      <span aria-hidden="true">{team.emblem.glyph}</span>
    </div>
  );
}
