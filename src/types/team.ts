/**
 * Team data model.
 *
 * Every team in the championship is a location-based Tasmanian club. Team
 * records are pure data: no interface component should ever hardcode a team
 * name, description or emblem. Replace or extend `src/data/teams.ts` to change
 * the roster of clubs without touching UI code.
 */

/** Stable identifiers for the six Tasmanian locations. */
export const TEAM_IDS = [
  'hobart',
  'launceston',
  'devonport',
  'burnie',
  'smithton',
  'rosebery',
] as const;

export type TeamId = (typeof TEAM_IDS)[number];

/**
 * Availability of a club's roster in the current build.
 * `featured` — fully authored and playable in Stage 1.
 * `scouted`  — club identity authored, roster is a documented placeholder.
 */
export type TeamStatus = 'featured' | 'scouted';

/** A pair of coordinates in the Tasmania map's own 0..100 viewBox space. */
export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

export interface Team {
  readonly id: TeamId;
  /** Real Tasmanian location the club represents. */
  readonly location: string;
  /** Fictional club name used in-game. */
  readonly name: string;
  /** Compact label for tight UI (cards, HUD). */
  readonly shortName: string;
  /** Placeholder emblem is drawn from these two colours plus the glyph. */
  readonly emblem: {
    readonly glyph: string;
    readonly primary: string;
    readonly secondary: string;
  };
  /** Headline discipline of the club, e.g. "Tactical and disciplined". */
  readonly style: string;
  /** The club's competitive strength, e.g. "Technique". */
  readonly strength: string;
  /** Club character, e.g. "Professional and organised". */
  readonly personality: string;
  /** Competition speciality shown on the team panel. */
  readonly speciality: string;
  /** Two-to-three sentence club description. */
  readonly description: string;
  readonly status: TeamStatus;
  /** Marker position on the Tasmania SVG map. */
  readonly mapPosition: MapPoint;
  /** Which side of the marker its label should sit on, to avoid overlaps. */
  readonly labelAnchor: 'start' | 'end' | 'middle';
}
