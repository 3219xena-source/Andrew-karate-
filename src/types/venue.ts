/**
 * Venue data model.
 *
 * Venues are fictional competition halls inspired by each Tasmanian location.
 * They make no claim about any real building. Every visual property here is
 * consumed by the procedural arena renderer — there are no image files.
 */

import type { TeamId } from './team.ts';

export interface VenuePalette {
  /** Back wall, top and bottom of a vertical gradient. */
  readonly wallTop: string;
  readonly wallBottom: string;
  /** Competition mat. */
  readonly matPrimary: string;
  readonly matSecondary: string;
  /** Structural trim: beams, rails, banner frames. */
  readonly trim: string;
  /** Crowd silhouette base colour. */
  readonly crowd: string;
  /** Accent used for lighting rigs and banner highlights. */
  readonly accent: string;
}

/** Background motif drawn behind the crowd, distinguishing each venue. */
export type VenueMotif =
  | 'mountain'
  | 'heritage-arches'
  | 'coastal-windows'
  | 'industrial-trusses'
  | 'timber-hall'
  | 'alpine-lodge';

export interface Venue {
  readonly id: string;
  readonly name: string;
  readonly location: string;
  /** Club that calls this venue home. */
  readonly homeTeamId: TeamId;
  /** One-line description shown on the venue introduction screen. */
  readonly description: string;
  /** Announcer-style line used in the venue introduction. */
  readonly atmosphere: string;
  readonly capacity: number;
  readonly palette: VenuePalette;
  readonly motif: VenueMotif;
  /** Text printed on the hanging banners. */
  readonly bannerText: string;
}
