/**
 * Club data model.
 *
 * Every club in the championship is a location-based Tasmanian club. Club
 * records are pure data: no interface component should ever hardcode a club
 * name, description or emblem. Replace or extend `src/data/teams.ts` to change
 * the roster of clubs without touching UI code.
 *
 * Any club may be selected as the player's home club — nothing in the game
 * privileges a particular id.
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
 * How hard this club is to beat, used to pick an AI difficulty band for its
 * fighters. Every club is fully authored and playable.
 */
export type ClubDifficulty = 'approachable' | 'competitive' | 'formidable';

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
  /** Club identity colours, used across HUD, banners and the arena. */
  readonly colours: {
    readonly primary: string;
    readonly secondary: string;
  };
  /** Id of the club's home venue in `src/data/venues.ts`. */
  readonly venueId: string;
  /** Head coach. A fictional character, like every other person in the game. */
  readonly coach: string;
  /** Headline discipline of the club, e.g. "Tactical and disciplined". */
  readonly style: string;
  /** The club's competitive strength, e.g. "Technique". */
  readonly strength: string;
  /** Club character, e.g. "Professional and organised". */
  readonly personality: string;
  /** Competition speciality shown on the club panel. */
  readonly speciality: string;
  /** Two-to-three sentence club description. */
  readonly description: string;
  readonly difficulty: ClubDifficulty;
  /** Marker position on the Tasmania SVG map. */
  readonly mapPosition: MapPoint;
  /** Which side of the marker its label should sit on, to avoid overlaps. */
  readonly labelAnchor: 'start' | 'end' | 'middle';
}
