/**
 * Central combat tuning.
 *
 * EVERY combat number lives here. No damage value, cost, duration or cooldown
 * is written anywhere else in the codebase — screens and renderers read state,
 * never rules.
 *
 * Units: arena units for distance, seconds for time, health points for damage.
 * The arena is a fixed logical space that the renderer scales to any canvas
 * size, so gameplay is resolution independent.
 */

/** Logical arena. The floor sits at y = 0 in fighter space. */
export const ARENA_WIDTH = 1200;
export const ARENA_HEIGHT = 560;
/** Fighters cannot walk closer to the edge than this. */
export const WALL_MARGIN = 70;

export const FIGHTER_HALF_WIDTH = 30;
export const FIGHTER_HEIGHT = 150;
/** Height used for collision while crouching. */
export const CROUCH_HEIGHT = 96;
/** Fighters cannot pass through each other; this is their minimum separation. */
export const MIN_SEPARATION = 62;

export const GRAVITY = 2700;

/** Starting positions, measured from the centre of the arena. */
export const START_OFFSET = 210;

/** Fixed simulation step. The loop accumulates real time into these. */
export const FIXED_STEP = 1 / 120;
/** Largest real frame simulated, so a backgrounded tab cannot teleport anyone. */
export const MAX_STEP = 1 / 30;

// ── Round rules ──────────────────────────────────────────────────────────────

export const ROUND_SECONDS = 60;
/** First to this many round wins takes the bout (best of three). */
export const ROUNDS_TO_WIN_BOUT = 2;
export const MAX_ROUNDS = 3;
/** Extra time played when a round ends level on health. */
export const SUDDEN_DEATH_SECONDS = 15;
/** Seconds of warning tone before time expires. */
export const TIME_WARNING_AT = 10;

// ── Resources ────────────────────────────────────────────────────────────────

export const BASE_HEALTH = 100;
export const BASE_STAMINA = 100;
export const MAX_POWER = 100;

/** Seconds of no stamina spending before regeneration begins. */
export const STAMINA_REGEN_DELAY = 0.45;
/** Multiplier applied to stamina regeneration while standing still. */
export const STAMINA_IDLE_BONUS = 1.4;

// ── Attacks ──────────────────────────────────────────────────────────────────

export type AttackId =
  | 'lightPunch'
  | 'strongPunch'
  | 'lightKick'
  | 'strongKick'
  | 'crouchAttack'
  | 'jumpAttack'
  | 'powerAttack';

export interface AttackSpec {
  /** Base damage before the attacker's power rating and the defender's guard. */
  readonly damage: number;
  readonly stamina: number;
  /** Seconds before the attack becomes active. */
  readonly windup: number;
  /** Seconds the hitbox is live. */
  readonly active: number;
  /** Seconds of recovery after the active window. */
  readonly recover: number;
  /** Horizontal reach from the fighter's centre. */
  readonly reach: number;
  /** Vertical band the attack covers, as a fraction of fighter height. */
  readonly lowEdge: number;
  readonly highEdge: number;
  /** Seconds the target is unable to act after being hit. */
  readonly hitstun: number;
  /** Horizontal impulse applied to the target on hit. */
  readonly knockback: number;
  /** Power meter gained by the attacker when this lands. */
  readonly powerOnHit: number;
  /** Power meter gained by the defender when this is blocked. */
  readonly powerOnBlocked: number;
  /** True when the attack cannot be stopped by a standing guard alone. */
  readonly lowAttack: boolean;
}

/**
 * The move table.
 *
 * Balance intent, all of which is asserted by tests in `combatBalance.test.ts`:
 *  - strong attacks are slower and more expensive than light attacks
 *  - kicks reach further than punches but start slower
 *  - the power attack is the strongest single option and is strictly limited
 *  - no attack is free: every one costs stamina
 *  - a full power meter is reachable inside a round the fighter has not already
 *    won: roughly ten clean light attacks, which is well short of a knockout
 */
export const ATTACKS: Readonly<Record<AttackId, AttackSpec>> = {
  lightPunch: {
    damage: 6,
    stamina: 7,
    windup: 0.07,
    active: 0.07,
    recover: 0.13,
    reach: 96,
    lowEdge: 0.35,
    highEdge: 1,
    hitstun: 0.18,
    knockback: 90,
    powerOnHit: 10,
    powerOnBlocked: 4,
    lowAttack: false,
  },
  strongPunch: {
    damage: 13,
    stamina: 18,
    windup: 0.18,
    active: 0.09,
    recover: 0.3,
    reach: 108,
    lowEdge: 0.35,
    highEdge: 1,
    hitstun: 0.32,
    knockback: 190,
    powerOnHit: 18,
    powerOnBlocked: 7,
    lowAttack: false,
  },
  lightKick: {
    damage: 8,
    stamina: 10,
    windup: 0.1,
    active: 0.08,
    recover: 0.18,
    reach: 124,
    lowEdge: 0.25,
    highEdge: 0.9,
    hitstun: 0.2,
    knockback: 120,
    powerOnHit: 12,
    powerOnBlocked: 5,
    lowAttack: false,
  },
  strongKick: {
    damage: 16,
    stamina: 22,
    windup: 0.24,
    active: 0.1,
    recover: 0.34,
    reach: 142,
    lowEdge: 0.25,
    highEdge: 0.95,
    hitstun: 0.36,
    knockback: 240,
    powerOnHit: 21,
    powerOnBlocked: 8,
    lowAttack: false,
  },
  /** Thrown from a crouch. Beats a standing guard, but has short reach. */
  crouchAttack: {
    damage: 9,
    stamina: 12,
    windup: 0.1,
    active: 0.08,
    recover: 0.2,
    reach: 104,
    lowEdge: 0,
    highEdge: 0.45,
    hitstun: 0.24,
    knockback: 110,
    powerOnHit: 13,
    powerOnBlocked: 6,
    lowAttack: true,
  },
  /**
   * Thrown while airborne, and aimed DOWNWARD — the band extends well below
   * the attacker's own feet so a jumping attack actually reaches a standing
   * opponent from the top of the arc. Beats a crouching guard.
   */
  jumpAttack: {
    damage: 12,
    stamina: 12,
    windup: 0.08,
    active: 0.16,
    recover: 0.12,
    reach: 112,
    lowEdge: -0.85,
    highEdge: 0.55,
    hitstun: 0.3,
    knockback: 160,
    powerOnHit: 16,
    powerOnBlocked: 7,
    lowAttack: false,
  },
  /** Spends the whole power meter. Scaled per fighter by their special move. */
  powerAttack: {
    damage: 24,
    stamina: 16,
    windup: 0.26,
    active: 0.14,
    recover: 0.42,
    reach: 150,
    lowEdge: 0.15,
    highEdge: 1.05,
    hitstun: 0.5,
    knockback: 330,
    powerOnHit: 0,
    powerOnBlocked: 0,
    lowAttack: false,
  },
};

/** Full power meter required to throw the power attack. */
export const POWER_ATTACK_COST = 100;
/** Power gained when hurt, so a losing fighter builds a comeback option. */
export const POWER_ON_DAMAGE_TAKEN = 0.55;
/** Power gained per successful dodge. */
export const POWER_ON_DODGE = 5;

// ── Defence ──────────────────────────────────────────────────────────────────

/** Fraction of damage that still lands through a correct guard. */
export const BLOCK_DAMAGE_MULTIPLIER = 0.2;
/** Fraction of damage taken when a low attack hits a standing guard. */
export const GUARD_BREAK_MULTIPLIER = 0.75;
/** Stamina drained per second while the guard is held. */
export const BLOCK_DRAIN_PER_SECOND = 11;
/** Stamina cost of absorbing one attack on the guard. */
export const BLOCK_IMPACT_STAMINA = 5;
/** Hitstun applied when an attack is blocked rather than landed. */
export const BLOCK_HITSTUN = 0.12;

export const DODGE_STAMINA = 18;
export const DODGE_SPEED = 520;
export const DODGE_WINDUP = 0.04;
/** Evasion frames: the dodge is invulnerable for this long after the wind-up. */
export const DODGE_INVULNERABLE = 0.2;
export const DODGE_RECOVER = 0.14;

/** Movement while the guard is up, as a fraction of normal walking speed. */
export const BLOCK_MOVE_SCALE = 0.4;
/** Movement while crouching. */
export const CROUCH_MOVE_SCALE = 0.35;

/** Seconds a knocked-down fighter stays down before the round can continue. */
export const KNOCKDOWN_TIME = 1.1;

// ── Per-fighter derivation ───────────────────────────────────────────────────

/**
 * Turns a fighter's authored 1..100 ratings into the values the engine uses.
 * This is the only place ratings become mechanics.
 */
export interface CombatProfile {
  readonly maxHealth: number;
  readonly maxStamina: number;
  readonly maxPower: number;
  readonly moveSpeed: number;
  readonly jumpVelocity: number;
  readonly staminaRegen: number;
  readonly blockDrain: number;
  /** Multiplier on attack durations; below 1 is faster. */
  readonly attackSpeedScale: number;
  /** Multiplier on dodge duration and cost; below 1 is better. */
  readonly dodgeScale: number;
  /** Multiplier on outgoing damage. */
  readonly damageScale: number;
  /** Multiplier on incoming damage; below 1 is tougher. */
  readonly toughness: number;
  /** Extra reach in arena units, from technique. */
  readonly reachBonus: number;
}

export interface RatingsInput {
  readonly strength: number;
  readonly speed: number;
  readonly defence: number;
  readonly technique: number;
  readonly stamina: number;
  readonly agility: number;
}

const NEUTRAL_RATINGS: RatingsInput = {
  strength: 70,
  speed: 70,
  defence: 70,
  technique: 70,
  stamina: 70,
  agility: 70,
};

export function deriveCombatProfile(ratings: RatingsInput | null | undefined): CombatProfile {
  const r = ratings ?? NEUTRAL_RATINGS;
  return {
    maxHealth: BASE_HEALTH + (r.defence - 70) * 0.35 + (r.stamina - 70) * 0.2,
    maxStamina: BASE_STAMINA + (r.stamina - 70) * 0.5,
    maxPower: MAX_POWER,
    moveSpeed: 210 + r.speed * 1.15 + r.agility * 0.35,
    jumpVelocity: 800 + r.agility * 1.8,
    staminaRegen: 12 + r.stamina * 0.14,
    blockDrain: Math.max(5, BLOCK_DRAIN_PER_SECOND + 6 - r.defence * 0.09),
    attackSpeedScale: 1.16 - r.technique / 450 - r.speed / 900,
    dodgeScale: 1.14 - r.agility / 500,
    damageScale: 0.7 + r.strength / 165,
    toughness: 1.18 - r.defence / 380,
    reachBonus: (r.technique - 70) * 0.16,
  };
}
