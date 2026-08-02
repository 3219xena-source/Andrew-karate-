/**
 * Two-fighter match engine types.
 *
 * The engine is free of DOM, React and canvas references: it is a pure state
 * machine advanced by `step(dt, inputs)`. Rendering, audio, the AI and the bout
 * controller all read from its output rather than driving it, which keeps the
 * combat rules unit-testable without a browser.
 */

import type { AttackId } from './constants.ts';

/** A snapshot of held inputs for one frame. Edge detection is done internally. */
export interface MatchInput {
  readonly left: boolean;
  readonly right: boolean;
  readonly up: boolean;
  readonly down: boolean;
  readonly lightPunch: boolean;
  readonly strongPunch: boolean;
  readonly lightKick: boolean;
  readonly strongKick: boolean;
  readonly block: boolean;
  readonly dodge: boolean;
  readonly power: boolean;
}

export const NEUTRAL_MATCH_INPUT: MatchInput = {
  left: false,
  right: false,
  up: false,
  down: false,
  lightPunch: false,
  strongPunch: false,
  lightKick: false,
  strongKick: false,
  block: false,
  dodge: false,
  power: false,
};

/** Which corner a fighter occupies. Also decides HUD side and start position. */
export type Corner = 'red' | 'blue';

/** Mutually exclusive action states. Movement is tracked separately. */
export type ActionName =
  | 'idle'
  | 'attack'
  | 'block'
  | 'dodge'
  | 'hitstun'
  | 'knockdown'
  | 'defeated';

export type ActionPhase = 'windup' | 'active' | 'recover';

export interface FighterCombatStats {
  damageDealt: number;
  damageTaken: number;
  punchesLanded: number;
  kicksLanded: number;
  strongAttacksLanded: number;
  attacksBlocked: number;
  dodgesSucceeded: number;
  powerMovesUsed: number;
  knockouts: number;
}

export interface FighterSim {
  readonly id: string;
  readonly corner: Corner;
  /** 'human' fighters read the keyboard; 'ai' fighters read the AI controller. */
  readonly controller: 'human' | 'ai';

  x: number;
  /** Height above the floor. 0 when grounded. */
  y: number;
  vx: number;
  vy: number;
  facing: -1 | 1;
  grounded: boolean;
  crouching: boolean;
  moving: boolean;

  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  power: number;
  maxPower: number;

  action: ActionName;
  phase: ActionPhase;
  actionTime: number;
  actionDuration: number;
  /** Which attack is being thrown, when `action` is 'attack'. */
  attack: AttackId | null;
  /** True once the current attack has connected, so one swing hits once. */
  attackConsumed: boolean;
  /** True during a dodge's evasion frames. */
  invulnerable: boolean;
  /** Seconds remaining before the fighter can act again. */
  hitstunRemaining: number;

  roundWins: number;
  stats: FighterCombatStats;
}

export type MatchPhase =
  /** Pre-round announcement; no input is accepted. */
  | 'ready'
  | 'fighting'
  /** A round has ended; the controller decides what happens next. */
  | 'round-over'
  /** Every round is done and the bout has a winner. */
  | 'bout-over';

export interface MatchState {
  /** Simulation time in seconds since the current round started. */
  time: number;
  /** Seconds left on the round clock. */
  timeRemaining: number;
  round: number;
  phase: MatchPhase;
  readonly red: FighterSim;
  readonly blue: FighterSim;
  /** Set when the round ends. */
  roundWinner: Corner | 'draw' | null;
  roundEndReason: 'knockout' | 'timeout' | 'draw' | null;
  /** Set when the bout ends. */
  boutWinner: Corner | null;
  /** True while sudden-death extra time is being played. */
  suddenDeath: boolean;
}

export type MatchEventType =
  | 'hit'
  | 'blocked'
  | 'dodged'
  | 'attack-thrown'
  | 'jump'
  | 'power-ready'
  | 'power-used'
  | 'exhausted'
  | 'knockdown'
  | 'knockout'
  | 'round-start'
  | 'round-end'
  | 'bout-end'
  | 'time-warning';

export interface MatchEvent {
  readonly type: MatchEventType;
  /** The corner that caused the event, where one applies. */
  readonly corner?: Corner;
  readonly attack?: AttackId;
  readonly damage?: number;
  /** World position of the event, for impact effects. */
  readonly x?: number;
  readonly y?: number;
  readonly at: number;
}
