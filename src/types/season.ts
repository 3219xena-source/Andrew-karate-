/**
 * Season, event and bout data model.
 *
 * A season is six events: five league rounds against each rival club, then the
 * Tasmania Championship Final. Every result below is derived from bouts the
 * player actually fought — nothing is simulated for the player's own club.
 */

import type { TeamId } from './team.ts';

export type EventKind = 'league' | 'championship';

export type EventStatus = 'locked' | 'available' | 'complete';

/** Outcome of a single round inside a bout. */
export type RoundOutcome = 'player' | 'opponent' | 'draw';

/** How a round ended, used for the round-result presentation. */
export type RoundEndReason = 'knockout' | 'timeout' | 'draw';

export interface BoutStats {
  readonly damageDealt: number;
  readonly damageTaken: number;
  readonly punchesLanded: number;
  readonly kicksLanded: number;
  readonly strongAttacksLanded: number;
  readonly attacksBlocked: number;
  readonly dodgesSucceeded: number;
  readonly powerMovesUsed: number;
  readonly knockouts: number;
}

export const EMPTY_BOUT_STATS: BoutStats = {
  damageDealt: 0,
  damageTaken: 0,
  punchesLanded: 0,
  kicksLanded: 0,
  strongAttacksLanded: 0,
  attacksBlocked: 0,
  dodgesSucceeded: 0,
  powerMovesUsed: 0,
  knockouts: 0,
};

export interface BoutResult {
  /** 0-based index of the bout within the event. 6 marks the tie-breaker. */
  readonly index: number;
  readonly playerFighterId: string;
  readonly opponentFighterId: string;
  readonly winner: 'player' | 'opponent';
  readonly playerRounds: number;
  readonly opponentRounds: number;
  /** How the deciding round finished. */
  readonly endReason: RoundEndReason;
  readonly stats: BoutStats;
  /** True when this bout was the 3–3 decider. */
  readonly isTieBreaker: boolean;
}

export interface EventResult {
  readonly eventId: string;
  readonly playerTeamId: TeamId;
  readonly opponentTeamId: TeamId;
  readonly playerBoutWins: number;
  readonly opponentBoutWins: number;
  readonly winner: 'player' | 'opponent';
  /** True when the event went to a seventh, deciding bout. */
  readonly decidedByTieBreaker: boolean;
  readonly bouts: readonly BoutResult[];
}

export interface SeasonEvent {
  readonly id: string;
  /** 1-based position in the season, which is also the unlock order. */
  readonly round: number;
  readonly kind: EventKind;
  readonly name: string;
  readonly venueId: string;
  readonly location: string;
  /**
   * Opponent club. For the championship this is resolved at unlock time from
   * the standings, so it is null until then.
   */
  readonly opponentTeamId: TeamId | null;
}

/** A club's running season record. */
export interface StandingsRow {
  readonly teamId: TeamId;
  readonly played: number;
  readonly eventWins: number;
  readonly eventLosses: number;
  readonly boutsWon: number;
  readonly boutsLost: number;
  readonly roundsWon: number;
  readonly roundsLost: number;
  readonly points: number;
}

/** Points awarded per event outcome. Documented in `docs/SEASON_SYSTEM.md`. */
export const POINTS_PER_EVENT_WIN = 3;
export const POINTS_PER_EVENT_LOSS = 0;

export interface SeasonState {
  readonly seasonId: string;
  readonly playerTeamId: TeamId;
  /** 1-based round number of the next event to play. 7 means season complete. */
  readonly currentRound: number;
  readonly events: readonly SeasonEvent[];
  readonly results: readonly EventResult[];
  readonly standings: readonly StandingsRow[];
  /** Resolved when round 5 completes. */
  readonly championshipOpponentId: TeamId | null;
  readonly seasonComplete: boolean;
  /** Set once the championship has been played. */
  readonly championshipWon: boolean | null;
}
