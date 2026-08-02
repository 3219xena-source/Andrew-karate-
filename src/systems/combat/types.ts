/**
 * Combat engine types.
 *
 * The engine is deliberately free of DOM, React and canvas references: it is a
 * pure state machine advanced by `step(dt, input)`. Rendering, audio and the
 * tutorial all read from its output rather than driving it. This keeps the
 * combat rules unit-testable without a browser and makes it straightforward to
 * add opponent AI in Stage 2 by driving a second fighter with the same struct.
 */

/** A snapshot of held inputs for one frame. Edge detection is done internally. */
export interface InputState {
  readonly left: boolean;
  readonly right: boolean;
  readonly jump: boolean;
  readonly light: boolean;
  readonly strong: boolean;
  readonly block: boolean;
  readonly dodge: boolean;
  readonly bow: boolean;
}

export const NEUTRAL_INPUT: InputState = {
  left: false,
  right: false,
  jump: false,
  light: false,
  strong: false,
  block: false,
  dodge: false,
  bow: false,
};

/**
 * Mutually exclusive action states. Movement and airborne state are tracked
 * separately, so a fighter can be walking while `action` is `'idle'`.
 */
export type ActionName = 'idle' | 'light' | 'strong' | 'block' | 'dodge' | 'bow' | 'stagger';

/** Phase within a timed action. `block` stays in `active` while held. */
export type ActionPhase = 'windup' | 'active' | 'recover';

export type AttackPower = 'light' | 'strong';

export type CombatEventType =
  /** An attack of `power` connected with the practice pad. */
  | 'hit'
  /** The player successfully blocked an incoming practice strike. */
  | 'block'
  /** A dodge was performed. Does not imply anything was evaded. */
  | 'dodge'
  /** A dodge's evasion frames beat an incoming practice strike. */
  | 'evade'
  /** An incoming practice strike is about to become active (telegraph). */
  | 'strike-telegraph'
  /** A practice strike touched the player: light contact, resets the guard. */
  | 'strike-contact'
  | 'jump'
  | 'bow'
  /** Light → light → strong landed inside the combination window. */
  | 'combo'
  /** An action was refused because stamina was too low. */
  | 'exhausted'
  /** Stamina fell to or below the low-stamina threshold. */
  | 'stamina-low'
  /** Stamina recovered to or above the recovered threshold after being low. */
  | 'stamina-recovered';

export interface CombatEvent {
  readonly type: CombatEventType;
  /** Present on `hit` events. */
  readonly power?: AttackPower;
  /** Simulation time, in seconds, at which the event occurred. */
  readonly at: number;
}

/**
 * Per-fighter tuning derived from the fighter's authored ratings. Produced by
 * `deriveCombatProfile` so that stat records — not the engine — decide how a
 * given fighter handles.
 */
export interface CombatProfile {
  readonly moveSpeed: number;
  readonly jumpVelocity: number;
  readonly staminaMax: number;
  /** Stamina restored per second once the regeneration delay has elapsed. */
  readonly staminaRegen: number;
  /** Stamina consumed per second while the block is held. */
  readonly blockDrain: number;
  /** Multiplier on all attack action durations; lower is faster. */
  readonly attackSpeedScale: number;
  /** Multiplier on dodge duration and cost; lower is better. */
  readonly dodgeScale: number;
}

export interface FighterState {
  /** Centre of the fighter's body, in arena units. */
  x: number;
  /** Height above the floor, in arena units. 0 when grounded. */
  y: number;
  vx: number;
  vy: number;
  /** -1 faces left, 1 faces right. */
  facing: -1 | 1;
  grounded: boolean;
  action: ActionName;
  phase: ActionPhase;
  /** Seconds elapsed inside the current action. */
  actionTime: number;
  /** Total duration of the current timed action, in seconds. */
  actionDuration: number;
  stamina: number;
  staminaMax: number;
  /** True while a dodge grants evasion frames. */
  invulnerable: boolean;
  /** Set once an attack has connected, so one swing cannot hit twice. */
  attackConsumed: boolean;
  /** True while the fighter is walking under player input. */
  moving: boolean;
}

/** Lifecycle of one practice strike thrown by the pad. */
export type PadPhase = 'idle' | 'telegraph' | 'active' | 'recover';

export interface PadState {
  readonly x: number;
  phase: PadPhase;
  /** Seconds elapsed inside the current pad phase. */
  phaseTime: number;
  /** True while the pad is instructed to throw practice strikes. */
  striking: boolean;
  /** Set once the active strike has resolved, so it resolves at most once. */
  strikeResolved: boolean;
  /** Cosmetic recoil, 0..1, from the player's most recent landed technique. */
  recoil: number;
}

export interface CombatState {
  /** Simulation time in seconds since the engine was created or reset. */
  time: number;
  readonly fighter: FighterState;
  readonly pad: PadState;
  /** Cumulative distance walked left, in arena units. */
  distanceLeft: number;
  /** Cumulative distance walked right, in arena units. */
  distanceRight: number;
  /** Landed techniques still inside the combination window, oldest first. */
  comboWindow: Array<{ power: AttackPower; at: number }>;
  /** True once stamina has been driven to the low threshold. */
  staminaWasLow: boolean;
}
