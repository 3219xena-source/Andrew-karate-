/**
 * Deterministic developer/automation hooks.
 *
 * These exist so the end-to-end suite can complete a whole six-event season
 * without playing six hours of real-time bouts, and so a developer can jump to
 * a state while working on a later screen.
 *
 * ── The important guarantee ──────────────────────────────────────────────────
 * Nothing here bypasses a game system. `simulateEvent` builds the SAME
 * `MatchEngine`, drives BOTH corners with the SAME `OpponentAI` the opponent
 * uses, resolves rounds through the SAME round and bout rules, and records
 * results through the SAME store action the fight screen calls. The only
 * difference is that the simulation steps the fixed timestep in a tight loop
 * instead of once per animation frame — so a bout that would take two minutes
 * of wall clock resolves in milliseconds, through identical state transitions.
 *
 * No hook sets a completion flag, awards a bout, or edits health, stamina,
 * power or the standings. Anything these hooks can do, a player can do.
 *
 * They are attached to `window.__tmac` in every build. They are inert unless
 * called, and they are documented in `docs/KNOWN_LIMITATIONS.md`.
 */

import { getTeam } from '../data/teams.ts';
import { OpponentAI, difficultyForClub } from './ai/opponentAI.ts';
import { MatchEngine } from './match/matchEngine.ts';
import { FIXED_STEP } from './match/constants.ts';
import { getEventController, useGameStore } from '../state/gameStore.ts';
import type { BoutResult } from '../types/season.ts';

/** Simulation steps allowed per bout before the loop gives up. */
const MAX_STEPS_PER_BOUT = 60_000;

export interface TmacTestHooks {
  /** Starts (or re-enters) the championship season for the selected club. */
  startSeason: () => void;
  /**
   * Resolves every remaining bout of the event in progress by simulating it
   * with the real engine and the real AI on both sides, then finishes the
   * event. Returns the recorded bout results.
   */
  simulateEvent: () => Promise<BoutResult[]>;
  /** Resolves a single bout the same way, without finishing the event. */
  simulateBout: () => Promise<BoutResult | null>;
  /** The current screen id, for assertions that do not depend on the DOM. */
  getScreen: () => string;
}

declare global {
  interface Window {
    __tmac?: TmacTestHooks;
  }
}

/**
 * Plays one bout to completion through the real engine, with both corners
 * driven by the AI controller. Returns the result the fight screen would have
 * produced from the same final state.
 */
function simulateOnePairing(
  playerFighterId: string,
  opponentFighterId: string,
  index: number,
  isTieBreaker: boolean,
): BoutResult | null {
  const state = useGameStore.getState();
  const controller = getEventController();
  if (!controller) return null;

  const pairing = controller
    .getPairings()
    .find((entry) => entry.player.id === playerFighterId) ??
    (isTieBreaker ? controller.getNextPairing() : null);
  const player = pairing?.player ?? null;
  const opponent = pairing?.opponent ?? null;
  if (!player || !opponent) return null;
  if (player.id !== playerFighterId || opponent.id !== opponentFighterId) {
    // The controller's view disagrees with the request; refuse rather than
    // simulate a bout that is not actually scheduled.
    return null;
  }

  const engine = new MatchEngine(player, opponent, { humanCorner: 'red' });

  const makeAi = (corner: 'red' | 'blue') =>
    new OpponentAI({
      difficulty: difficultyForClub(
        getTeam(corner === 'red' ? player.teamId : opponent.teamId)?.difficulty ?? 'competitive',
        state.difficulty,
      ),
      profile: corner === 'red' ? player.aiProfile : opponent.aiProfile,
      corner,
      seed: hashString(`${player.id}:${opponent.id}:${corner}`),
    });

  const redAi = makeAi('red');
  const blueAi = makeAi('blue');

  engine.beginFighting();

  let steps = 0;
  while (steps < MAX_STEPS_PER_BOUT) {
    const current = engine.getState();

    if (current.phase === 'bout-over') break;
    if (current.phase === 'round-over') {
      engine.startNextRound();
      engine.beginFighting();
      continue;
    }
    if (current.phase === 'ready') {
      engine.beginFighting();
      continue;
    }

    engine.step(FIXED_STEP, redAi.update(current, FIXED_STEP), blueAi.update(current, FIXED_STEP));
    // Events are drained so the buffer cannot grow unbounded during a long bout.
    engine.drainEvents();
    steps += 1;
  }

  const final = engine.getState();
  if (final.boutWinner === null) return null;

  const red = final.red;
  const blue = final.blue;
  return {
    index,
    playerFighterId: red.id,
    opponentFighterId: blue.id,
    winner: final.boutWinner === 'red' ? 'player' : 'opponent',
    playerRounds: red.roundWins,
    opponentRounds: blue.roundWins,
    endReason: final.roundEndReason ?? 'timeout',
    stats: {
      damageDealt: Math.round(red.stats.damageDealt),
      damageTaken: Math.round(red.stats.damageTaken),
      punchesLanded: red.stats.punchesLanded,
      kicksLanded: red.stats.kicksLanded,
      strongAttacksLanded: red.stats.strongAttacksLanded,
      attacksBlocked: red.stats.attacksBlocked,
      dodgesSucceeded: red.stats.dodgesSucceeded,
      powerMovesUsed: red.stats.powerMovesUsed,
      knockouts: red.stats.knockouts,
    },
    isTieBreaker,
  };
}

/** Attaches the hooks to `window`. Safe to call more than once. */
export function installTestHooks(): void {
  if (typeof window === 'undefined') return;

  window.__tmac = {
    startSeason: () => {
      useGameStore.getState().startSeason();
    },

    getScreen: () => useGameStore.getState().screen,

    simulateBout: async () => {
      const controller = getEventController();
      const pairing = controller?.getNextPairing();
      if (!controller || !pairing) return null;
      const result = simulateOnePairing(
        pairing.player.id,
        pairing.opponent.id,
        pairing.index,
        pairing.index >= 6,
      );
      if (result) useGameStore.getState().recordBoutResult(result);
      return result;
    },

    simulateEvent: async () => {
      const recorded: BoutResult[] = [];
      // Bounded so a rules bug cannot spin here forever: six scheduled bouts
      // plus one decider, with a little headroom.
      for (let guard = 0; guard < 10; guard += 1) {
        const controller = getEventController();
        if (!controller || controller.isComplete()) break;
        const pairing = controller.getNextPairing();
        if (!pairing) break;

        const result = simulateOnePairing(
          pairing.player.id,
          pairing.opponent.id,
          pairing.index,
          pairing.index >= 6,
        );
        if (!result) break;

        useGameStore.getState().recordBoutResult(result);
        recorded.push(result);
      }

      const controller = getEventController();
      if (controller?.isComplete()) useGameStore.getState().finishEvent();
      return recorded;
    },
  };
}

function hashString(input: string): number {
  let value = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value);
}
