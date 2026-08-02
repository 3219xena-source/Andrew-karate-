/**
 * Combat tuning constants, in arena units and seconds.
 *
 * The arena is a fixed-size logical space; the renderer scales it to whatever
 * canvas size the screen provides, so gameplay is resolution independent.
 */

/** Logical arena width. The floor line sits at y = 0 in fighter space. */
export const ARENA_WIDTH = 1000;
export const ARENA_HEIGHT = 520;

/** Fighter body dimensions used for collision and rendering. */
export const FIGHTER_HALF_WIDTH = 26;
export const FIGHTER_HEIGHT = 132;

export const GRAVITY = 2600;
export const WALL_MARGIN = 40;

/** Where the fighter is placed on reset, and the tutorial's marked area. */
export const START_X = 260;
export const MARK_X = 430;
export const MARK_RADIUS = 46;

/** The practice pad's fixed position and reach. */
export const PAD_X = 700;
export const PAD_HALF_WIDTH = 34;
export const PAD_HEIGHT = 140;
/** Distance from the pad within which its practice strike can touch a fighter. */
export const PAD_STRIKE_REACH = 190;

/** Pad practice-strike timings. */
export const PAD_TELEGRAPH_TIME = 0.62;
export const PAD_ACTIVE_TIME = 0.2;
export const PAD_RECOVER_TIME = 0.85;

/** Attack reach measured from the fighter's centre, per power. */
export const ATTACK_REACH = {
  light: 92,
  strong: 116,
} as const;

/** Action timings, before per-fighter scaling. */
export const ACTION_TIMING = {
  light: { windup: 0.09, active: 0.08, recover: 0.15 },
  strong: { windup: 0.22, active: 0.11, recover: 0.34 },
  dodge: { windup: 0.05, active: 0.21, recover: 0.12 },
  bow: { windup: 0.35, active: 0.3, recover: 0.35 },
  stagger: { windup: 0, active: 0.18, recover: 0.2 },
} as const;

/** Horizontal speed applied for the duration of a dodge. */
export const DODGE_SPEED = 470;

/** Stamina costs, before per-fighter scaling. */
export const STAMINA_COST = {
  light: 8,
  strong: 21,
  dodge: 17,
  /** Charged once when a practice strike is absorbed on the guard. */
  blockImpact: 7,
} as const;

/** Seconds of no spending before stamina begins to regenerate. */
export const STAMINA_REGEN_DELAY = 0.5;

/** Ratio thresholds used by the stamina-recovery tutorial objective. */
export const STAMINA_LOW_RATIO = 0.3;
export const STAMINA_RECOVERED_RATIO = 0.9;

/** Maximum gap between landed techniques for them to count as a combination. */
export const COMBO_WINDOW = 1.2;

/** Largest simulation step accepted, so a backgrounded tab cannot teleport. */
export const MAX_STEP = 1 / 30;
/** Fixed simulation step. The loop accumulates real time into these. */
export const FIXED_STEP = 1 / 120;
