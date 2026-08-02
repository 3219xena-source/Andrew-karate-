/**
 * Opponent AI.
 *
 * The AI is a pure function of the visible match state: it returns a
 * `MatchInput` exactly like the keyboard does, and the engine cannot tell the
 * difference. That has three consequences worth stating explicitly:
 *
 *  1. It cannot cheat. It has no way to change health, stamina, power or
 *     position — it can only press the same buttons a player can, and every
 *     cost, cooldown and hitstun rule applies to it identically.
 *  2. It cannot read the future. It reacts to what has already happened, with
 *     a difficulty-scaled reaction delay before it may respond to a new event.
 *  3. It can be tested headlessly, including AI-versus-AI, because it needs
 *     nothing but the state the engine already produces.
 *
 * Difficulty changes reaction time, aggression, guard discipline and technique
 * selection. It never changes damage, health or any other rule.
 */

import type { AiProfile } from '../../types/fighter.ts';
import { ATTACKS, POWER_ATTACK_COST } from '../match/constants.ts';
import { NEUTRAL_MATCH_INPUT, type Corner, type FighterSim, type MatchInput, type MatchState } from '../match/types.ts';

export type Difficulty = 'beginner' | 'standard' | 'advanced';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: 'Beginner',
  standard: 'Standard',
  advanced: 'Advanced',
};

/** The AI's visible decision state, surfaced in the HUD for transparency. */
export type AiIntent =
  | 'idle'
  | 'approach'
  | 'retreat'
  | 'attack'
  | 'combo'
  | 'defend'
  | 'evade'
  | 'recover'
  | 'finisher'
  | 'stunned'
  | 'defeated';

interface DifficultyTuning {
  /** Seconds before the AI may react to a change in the situation. */
  readonly reaction: number;
  /** 0..1 chance of choosing to press an attack when in range. */
  readonly aggression: number;
  /** 0..1 chance of raising the guard when an attack is incoming. */
  readonly guard: number;
  /** 0..1 chance of dodging rather than blocking when threatened. */
  readonly evasion: number;
  /** 0..1 chance of extending a landed attack into a second one. */
  readonly combo: number;
  /** Stamina floor below which the AI backs off to recover. */
  readonly staminaFloor: number;
  /** Seconds of enforced pause between decisions, preventing frame-perfect play. */
  readonly decisionInterval: number;
}

const TUNING: Record<Difficulty, DifficultyTuning> = {
  beginner: {
    reaction: 0.42,
    aggression: 0.34,
    guard: 0.3,
    evasion: 0.08,
    combo: 0.12,
    staminaFloor: 0.34,
    decisionInterval: 0.3,
  },
  standard: {
    reaction: 0.24,
    aggression: 0.55,
    guard: 0.58,
    evasion: 0.24,
    combo: 0.35,
    staminaFloor: 0.26,
    decisionInterval: 0.18,
  },
  advanced: {
    reaction: 0.14,
    aggression: 0.72,
    guard: 0.78,
    evasion: 0.42,
    combo: 0.55,
    staminaFloor: 0.2,
    decisionInterval: 0.12,
  },
};

/** Per-fighter personality, layered on top of the difficulty band. */
interface ProfileTuning {
  readonly aggressionBias: number;
  readonly guardBias: number;
  readonly evasionBias: number;
  /** Preferred distance from the opponent, in arena units. */
  readonly preferredRange: number;
  /** Weighting for kicks over punches, 0..1. */
  readonly kickBias: number;
}

const PROFILES: Record<AiProfile, ProfileTuning> = {
  aggressive: { aggressionBias: 0.2, guardBias: -0.15, evasionBias: -0.05, preferredRange: 96, kickBias: 0.35 },
  defensive: { aggressionBias: -0.18, guardBias: 0.22, evasionBias: 0.02, preferredRange: 138, kickBias: 0.4 },
  balanced: { aggressionBias: 0, guardBias: 0, evasionBias: 0, preferredRange: 116, kickBias: 0.45 },
  evasive: { aggressionBias: -0.05, guardBias: -0.1, evasionBias: 0.28, preferredRange: 130, kickBias: 0.5 },
  technical: { aggressionBias: 0.02, guardBias: 0.12, evasionBias: 0.12, preferredRange: 122, kickBias: 0.55 },
  powerhouse: { aggressionBias: 0.12, guardBias: 0.14, evasionBias: -0.12, preferredRange: 100, kickBias: 0.25 },
};

/**
 * Deterministic pseudo-random source.
 *
 * The AI must vary its choices, but a real random source would make matches
 * unreproducible and tests flaky. This is seeded per controller, so a given
 * seed always produces the same fight.
 */
class Rng {
  private seed: number;

  constructor(seed: number) {
    // Any non-zero 31-bit seed works; fold the input to guarantee that.
    this.seed = (Math.abs(Math.trunc(seed)) % 2147483646) + 1;
  }

  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }
}

export interface OpponentAiOptions {
  readonly difficulty: Difficulty;
  readonly profile: AiProfile;
  readonly corner: Corner;
  /** Seed for the deterministic decision source. */
  readonly seed?: number;
}

export class OpponentAI {
  private readonly tuning: DifficultyTuning;
  private readonly personality: ProfileTuning;
  private readonly corner: Corner;
  private readonly rng: Rng;

  private input: MatchInput = NEUTRAL_MATCH_INPUT;
  private intent: AiIntent = 'idle';
  private decisionTimer = 0;
  private reactionTimer = 0;
  /** Remembers the opponent's last action so a *change* triggers a reaction. */
  private lastSeenOpponentAction = '';
  /** Frames left holding the current attack button, so presses are edges. */
  private pressTimer = 0;

  constructor(options: OpponentAiOptions) {
    this.tuning = TUNING[options.difficulty];
    this.personality = PROFILES[options.profile];
    this.corner = options.corner;
    this.rng = new Rng(options.seed ?? 20260802);
  }

  getIntent(): AiIntent {
    return this.intent;
  }

  /**
   * Produces the AI's input for this frame.
   *
   * Buttons are released for one frame after being pressed, so every attack is
   * a genuine edge — the AI cannot hold a button down to attack continuously
   * any more than a player can.
   */
  update(state: MatchState, dt: number): MatchInput {
    const self = this.corner === 'red' ? state.red : state.blue;
    const foe = this.corner === 'red' ? state.blue : state.red;

    if (state.phase !== 'fighting') {
      this.intent = state.phase === 'bout-over' ? 'defeated' : 'idle';
      this.input = NEUTRAL_MATCH_INPUT;
      return this.input;
    }

    // Being stunned or beaten outranks everything, including the button-release
    // frame: a fighter who cannot act must not be holding anything down.
    if (self.action === 'defeated') {
      this.intent = 'defeated';
      this.pressTimer = 0;
      this.input = NEUTRAL_MATCH_INPUT;
      return this.input;
    }

    if (self.action === 'hitstun' || self.action === 'knockdown') {
      this.intent = 'stunned';
      this.pressTimer = 0;
      this.input = NEUTRAL_MATCH_INPUT;
      return this.input;
    }

    // Release any button held from the previous frame before deciding again, so
    // every attack is a genuine edge rather than a held button.
    if (this.pressTimer > 0) {
      this.pressTimer -= dt;
      this.input = { ...this.input, ...RELEASED_BUTTONS };
      return this.input;
    }

    // Reaction delay: a change in what the opponent is doing cannot be answered
    // instantly. This is what stops the AI feeling like it reads inputs.
    const opponentAction = `${foe.action}:${foe.attack ?? ''}`;
    if (opponentAction !== this.lastSeenOpponentAction) {
      this.lastSeenOpponentAction = opponentAction;
      this.reactionTimer = this.tuning.reaction;
    }
    if (this.reactionTimer > 0) this.reactionTimer -= dt;

    this.decisionTimer -= dt;
    if (this.decisionTimer > 0) return this.input;
    this.decisionTimer = this.tuning.decisionInterval;

    this.input = this.decide(self, foe);
    return this.input;
  }

  private decide(self: FighterSim, foe: FighterSim): MatchInput {
    const distance = Math.abs(foe.x - self.x);
    const towards = foe.x > self.x ? 'right' : 'left';
    const away = towards === 'right' ? 'left' : 'right';
    const staminaRatio = self.stamina / self.maxStamina;
    const healthRatio = self.health / self.maxHealth;

    const aggression = clamp01(this.tuning.aggression + this.personality.aggressionBias);
    const guard = clamp01(this.tuning.guard + this.personality.guardBias);
    const evasion = clamp01(this.tuning.evasion + this.personality.evasionBias);

    const threatened = this.isThreatened(self, foe, distance);
    const canReact = this.reactionTimer <= 0;

    // 1. Defend or evade an incoming attack, once the reaction delay has passed.
    if (threatened && canReact) {
      if (evasion > 0 && staminaRatio > 0.3 && this.rng.chance(evasion)) {
        this.intent = 'evade';
        return this.press({ dodge: true, [away]: true });
      }
      if (this.rng.chance(guard)) {
        this.intent = 'defend';
        // Crouch-block a low attack, stand-block anything else.
        const low = foe.attack ? ATTACKS[foe.attack].lowAttack : false;
        return this.hold({ block: true, down: low });
      }
    }

    // 2. Recover when stamina is spent. Backing off is the honest way to do it.
    if (staminaRatio < this.tuning.staminaFloor) {
      this.intent = 'recover';
      // Retreat if close, otherwise simply stand still and breathe.
      return distance < 200 ? this.hold({ [away]: true }) : this.hold({});
    }

    // 3. Finisher: a full meter near a decisive moment is worth spending.
    if (self.power >= POWER_ATTACK_COST && distance < 150 && canReact) {
      const worthIt = foe.health / foe.maxHealth < 0.45 || healthRatio < 0.4 || this.rng.chance(0.5);
      if (worthIt) {
        this.intent = 'finisher';
        return this.press({ power: true });
      }
    }

    // 4. In range: attack, or hold position.
    const inRange = distance < this.attackRange(self);
    if (inRange) {
      if (this.rng.chance(aggression)) {
        this.intent = this.rng.chance(this.tuning.combo) ? 'combo' : 'attack';
        return this.press(this.chooseAttackButtons(self, foe, distance));
      }
      // Not attacking this beat: keep the guard up rather than standing open.
      this.intent = 'defend';
      return this.hold({ block: this.rng.chance(guard) });
    }

    // 5. Out of range: close the distance, or hold the preferred spacing.
    const preferred = this.personality.preferredRange;
    if (distance > preferred + 40) {
      this.intent = 'approach';
      return this.hold({ [towards]: true });
    }
    if (distance < preferred - 50) {
      this.intent = 'retreat';
      return this.hold({ [away]: true });
    }

    this.intent = 'idle';
    return this.hold({});
  }

  /** True when the opponent is winding up or swinging within reach. */
  private isThreatened(self: FighterSim, foe: FighterSim, distance: number): boolean {
    if (foe.action !== 'attack' || !foe.attack) return false;
    if (foe.phase === 'recover') return false;
    const spec = ATTACKS[foe.attack];
    // Only treat it as a threat if it could actually reach.
    return distance <= spec.reach + 70 && Math.sign(self.x - foe.x) === foe.facing;
  }

  private attackRange(self: FighterSim): number {
    // Kicks reach furthest; use that as the engagement envelope.
    return self.crouching ? ATTACKS.crouchAttack.reach + 40 : ATTACKS.lightKick.reach + 40;
  }

  private chooseAttackButtons(
    self: FighterSim,
    foe: FighterSim,
    distance: number,
  ): Partial<MatchInput> {
    // A crouching opponent invites a high attack; a blocking one invites a low.
    if (foe.action === 'block' && !foe.crouching && this.rng.chance(0.45)) {
      return { down: true, lightPunch: true };
    }
    if (!foe.grounded && this.rng.chance(0.5)) {
      return { strongPunch: true };
    }

    const wantsKick = this.rng.chance(this.personality.kickBias);
    const wantsStrong =
      distance > 100 ? this.rng.chance(0.45) : this.rng.chance(0.25);
    const affordable = (cost: number): boolean => self.stamina >= cost;

    if (wantsKick) {
      if (wantsStrong && affordable(ATTACKS.strongKick.stamina)) return { strongKick: true };
      if (affordable(ATTACKS.lightKick.stamina)) return { lightKick: true };
    }
    if (wantsStrong && affordable(ATTACKS.strongPunch.stamina)) return { strongPunch: true };
    if (affordable(ATTACKS.lightPunch.stamina)) return { lightPunch: true };

    // Cannot afford anything: hold position rather than pressing a dead button.
    return {};
  }

  /** A momentary press: held this frame, released next frame. */
  private press(buttons: Partial<MatchInput>): MatchInput {
    this.pressTimer = 0.05;
    return { ...NEUTRAL_MATCH_INPUT, ...buttons };
  }

  /** A sustained hold, such as walking or blocking. */
  private hold(buttons: Partial<MatchInput>): MatchInput {
    return { ...NEUTRAL_MATCH_INPUT, ...buttons };
  }
}

const RELEASED_BUTTONS: Partial<MatchInput> = {
  lightPunch: false,
  strongPunch: false,
  lightKick: false,
  strongKick: false,
  dodge: false,
  power: false,
  up: false,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Maps a club's difficulty band to an AI difficulty when none is chosen. */
export function difficultyForClub(
  clubDifficulty: 'approachable' | 'competitive' | 'formidable',
  playerChoice: Difficulty,
): Difficulty {
  if (playerChoice === 'beginner') return 'beginner';
  if (playerChoice === 'advanced') return 'advanced';
  // On Standard, the club's own profile shifts the band by one step.
  if (clubDifficulty === 'approachable') return 'beginner';
  if (clubDifficulty === 'formidable') return 'advanced';
  return 'standard';
}
