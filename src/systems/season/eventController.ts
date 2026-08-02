/**
 * Club event controller.
 *
 * A club event is six sequential one-versus-one bouts, paired slot for slot,
 * followed by a deciding seventh bout if the score reaches 3–3. The controller
 * owns the bout order, the running club score and the completion rules; it does
 * not know how a bout is played, only how one is scored.
 *
 * Tie-break rule (documented in `docs/SEASON_SYSTEM.md`): at 3–3 each club
 * nominates its highest-rated open-division competitor for a seventh, deciding
 * bout. Juniors are never nominated, so the decider is always a legal pairing.
 */

import type { Fighter } from '../../types/fighter.ts';
import type { BoutResult, EventResult } from '../../types/season.ts';
import type { TeamId } from '../../types/team.ts';
import {
  buildBoutOrder,
  selectTieBreakerPair,
  type BoutPairing,
  type PairingResult,
} from '../match/matchmaking.ts';

/** Bouts contested before a tie-breaker can be needed. */
export const BOUTS_PER_EVENT = 6;

export interface EventControllerOptions {
  readonly eventId: string;
  readonly playerTeamId: TeamId;
  readonly opponentTeamId: TeamId;
  readonly playerRoster: readonly Fighter[];
  readonly opponentRoster: readonly Fighter[];
  /** Results already recorded, used when resuming a partly-played event. */
  readonly completedBouts?: readonly BoutResult[];
}

export class EventController {
  private readonly eventId: string;
  private readonly playerTeamId: TeamId;
  private readonly opponentTeamId: TeamId;
  private readonly playerRoster: readonly Fighter[];
  private readonly opponentRoster: readonly Fighter[];
  private readonly pairings: readonly BoutPairing[];
  private readonly rejected: ReadonlyArray<{ index: number; result: PairingResult }>;
  private readonly bouts: BoutResult[];

  constructor(options: EventControllerOptions) {
    this.eventId = options.eventId;
    this.playerTeamId = options.playerTeamId;
    this.opponentTeamId = options.opponentTeamId;
    this.playerRoster = options.playerRoster;
    this.opponentRoster = options.opponentRoster;

    const order = buildBoutOrder(options.playerRoster, options.opponentRoster);
    this.pairings = order.pairings;
    this.rejected = order.rejected;
    this.bouts = [...(options.completedBouts ?? [])];
  }

  /**
   * Pairings that failed matchmaking validation. Empty for a correctly authored
   * season; surfaced rather than silently dropped so a content error is visible.
   */
  getRejectedPairings(): ReadonlyArray<{ index: number; result: PairingResult }> {
    return this.rejected;
  }

  getPairings(): readonly BoutPairing[] {
    return this.pairings;
  }

  getCompletedBouts(): readonly BoutResult[] {
    return this.bouts;
  }

  getPlayerScore(): number {
    return this.bouts.filter((bout) => bout.winner === 'player').length;
  }

  getOpponentScore(): number {
    return this.bouts.filter((bout) => bout.winner === 'opponent').length;
  }

  /**
   * The pairing to be fought next, or null when the event is finished.
   *
   * All six scheduled bouts are always contested, even after one club has
   * mathematically won the tie. That is how club competition works, it gives
   * every fighter their bout, and it is what makes 5–1 and 6–0 score lines
   * reachable.
   */
  getNextPairing(): BoutPairing | null {
    if (this.isComplete()) return null;

    const scheduled = this.bouts.filter((bout) => !bout.isTieBreaker).length;
    if (scheduled < this.pairings.length) {
      return this.pairings[scheduled] ?? null;
    }

    if (this.needsTieBreaker()) {
      return selectTieBreakerPair(this.playerRoster, this.opponentRoster);
    }

    return null;
  }

  /** True when the six scheduled bouts finished level at 3–3. */
  needsTieBreaker(): boolean {
    const scheduled = this.bouts.filter((bout) => !bout.isTieBreaker);
    if (scheduled.length < this.pairings.length) return false;
    if (this.bouts.some((bout) => bout.isTieBreaker)) return false;
    const player = scheduled.filter((bout) => bout.winner === 'player').length;
    const opponent = scheduled.filter((bout) => bout.winner === 'opponent').length;
    return player === opponent;
  }

  /** Records a completed bout. Ignores a duplicate index. */
  recordBout(result: BoutResult): void {
    if (this.bouts.some((bout) => bout.index === result.index)) return;
    this.bouts.push(result);
    this.bouts.sort((a, b) => a.index - b.index);
  }

  isComplete(): boolean {
    const scheduled = this.bouts.filter((bout) => !bout.isTieBreaker).length;
    if (scheduled < this.pairings.length) return false;

    // All six fought: complete unless it is level and awaiting a decider.
    if (this.getPlayerScore() !== this.getOpponentScore()) return true;
    return this.bouts.some((bout) => bout.isTieBreaker);
  }

  /** Builds the saved result. Returns null while the event is still running. */
  getResult(): EventResult | null {
    if (!this.isComplete()) return null;
    const playerBoutWins = this.getPlayerScore();
    const opponentBoutWins = this.getOpponentScore();
    return {
      eventId: this.eventId,
      playerTeamId: this.playerTeamId,
      opponentTeamId: this.opponentTeamId,
      playerBoutWins,
      opponentBoutWins,
      winner: playerBoutWins > opponentBoutWins ? 'player' : 'opponent',
      decidedByTieBreaker: this.bouts.some((bout) => bout.isTieBreaker),
      bouts: [...this.bouts],
    };
  }
}
