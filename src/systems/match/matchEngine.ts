/**
 * Two-fighter match engine.
 *
 * A deterministic fixed-step state machine for one bout between two fighters.
 * Both fighters obey identical rules and expose the identical `MatchInput`
 * interface — the engine does not know or care which of them is a human and
 * which is the AI, which is what makes AI-versus-AI simulation possible.
 *
 * Presentation contract: this is sport karate. Health represents a competitor's
 * condition across a round, not injury. There is no blood, no injury state and
 * no fatality — a fighter who reaches zero health is simply unable to continue
 * the round, and the referee stops it.
 *
 * Guard interactions form a readable triangle:
 *
 *     standing block  beats  high attacks   loses to  crouch attacks
 *     crouching block beats  low attacks    loses to  jump attacks
 *     dodge           beats  everything     costs     stamina and commitment
 */

import type { Fighter } from '../../types/fighter.ts';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  ATTACKS,
  BLOCK_DAMAGE_MULTIPLIER,
  BLOCK_HITSTUN,
  BLOCK_IMPACT_STAMINA,
  BLOCK_MOVE_SCALE,
  CROUCH_HEIGHT,
  CROUCH_MOVE_SCALE,
  DODGE_INVULNERABLE,
  DODGE_RECOVER,
  DODGE_SPEED,
  DODGE_STAMINA,
  DODGE_WINDUP,
  FIGHTER_HALF_WIDTH,
  FIGHTER_HEIGHT,
  FIXED_STEP,
  GRAVITY,
  GUARD_BREAK_MULTIPLIER,
  KNOCKDOWN_TIME,
  MAX_ROUNDS,
  MAX_STEP,
  MIN_SEPARATION,
  POWER_ATTACK_COST,
  POWER_ON_DAMAGE_TAKEN,
  POWER_ON_DODGE,
  ROUNDS_TO_WIN_BOUT,
  ROUND_SECONDS,
  STAMINA_IDLE_BONUS,
  STAMINA_REGEN_DELAY,
  START_OFFSET,
  SUDDEN_DEATH_SECONDS,
  TIME_WARNING_AT,
  WALL_MARGIN,
  deriveCombatProfile,
  type AttackId,
  type CombatProfile,
} from './constants.ts';
import {
  NEUTRAL_MATCH_INPUT,
  type Corner,
  type FighterCombatStats,
  type FighterSim,
  type MatchEvent,
  type MatchEventType,
  type MatchInput,
  type MatchState,
} from './types.ts';

function emptyStats(): FighterCombatStats {
  return {
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
}

const PUNCHES: ReadonlySet<AttackId> = new Set(['lightPunch', 'strongPunch']);
const KICKS: ReadonlySet<AttackId> = new Set(['lightKick', 'strongKick']);
const STRONG: ReadonlySet<AttackId> = new Set(['strongPunch', 'strongKick', 'powerAttack']);

export interface MatchEngineOptions {
  /** Which corner the human plays. The other is driven by the AI. */
  readonly humanCorner?: Corner;
  /** Round length override, used by deterministic tests. */
  readonly roundSeconds?: number;
}

/** Everything the engine needs to know about one competitor. */
interface Side {
  readonly fighter: Fighter;
  readonly profile: CombatProfile;
  sim: FighterSim;
  previousInput: MatchInput;
  timeSinceSpend: number;
  knockdownTimer: number;
  /** True once the power-ready cue has fired for the current fill. */
  powerCueFired: boolean;
}

export class MatchEngine {
  private readonly red: Side;
  private readonly blue: Side;
  private readonly roundSeconds: number;
  private state: MatchState;
  private events: MatchEvent[] = [];
  private accumulator = 0;
  private warningFired = false;

  constructor(redFighter: Fighter, blueFighter: Fighter, options: MatchEngineOptions = {}) {
    const humanCorner = options.humanCorner ?? 'red';
    this.roundSeconds = options.roundSeconds ?? ROUND_SECONDS;

    this.red = this.createSide(redFighter, 'red', humanCorner === 'red' ? 'human' : 'ai');
    this.blue = this.createSide(blueFighter, 'blue', humanCorner === 'blue' ? 'human' : 'ai');

    this.state = {
      time: 0,
      timeRemaining: this.roundSeconds,
      round: 1,
      phase: 'ready',
      red: this.red.sim,
      blue: this.blue.sim,
      roundWinner: null,
      roundEndReason: null,
      boutWinner: null,
      suddenDeath: false,
    };
  }

  private createSide(fighter: Fighter, corner: Corner, controller: 'human' | 'ai'): Side {
    const profile = deriveCombatProfile(fighter.stats);
    return {
      fighter,
      profile,
      sim: this.createSim(fighter, corner, controller, profile),
      previousInput: NEUTRAL_MATCH_INPUT,
      timeSinceSpend: STAMINA_REGEN_DELAY,
      knockdownTimer: 0,
      powerCueFired: false,
    };
  }

  private createSim(
    fighter: Fighter,
    corner: Corner,
    controller: 'human' | 'ai',
    profile: CombatProfile,
  ): FighterSim {
    const centre = ARENA_WIDTH / 2;
    return {
      id: fighter.id,
      corner,
      controller,
      x: corner === 'red' ? centre - START_OFFSET : centre + START_OFFSET,
      y: 0,
      vx: 0,
      vy: 0,
      facing: corner === 'red' ? 1 : -1,
      grounded: true,
      crouching: false,
      moving: false,
      health: profile.maxHealth,
      maxHealth: profile.maxHealth,
      stamina: profile.maxStamina,
      maxStamina: profile.maxStamina,
      power: 0,
      maxPower: profile.maxPower,
      action: 'idle',
      phase: 'recover',
      actionTime: 0,
      actionDuration: 0,
      attack: null,
      attackConsumed: false,
      invulnerable: false,
      hitstunRemaining: 0,
      roundWins: 0,
      stats: emptyStats(),
    };
  }

  // ── Public API ────────────────────────────────────────────────────────────

  getState(): Readonly<MatchState> {
    return this.state;
  }

  getFighterRecord(corner: Corner): Fighter {
    return corner === 'red' ? this.red.fighter : this.blue.fighter;
  }

  getProfile(corner: Corner): CombatProfile {
    return corner === 'red' ? this.red.profile : this.blue.profile;
  }

  drainEvents(): MatchEvent[] {
    if (this.events.length === 0) return [];
    const drained = this.events;
    this.events = [];
    return drained;
  }

  /** Moves from the pre-round announcement into live play. */
  beginFighting(): void {
    if (this.state.phase !== 'ready') return;
    this.state.phase = 'fighting';
    this.emit('round-start');
  }

  /**
   * Starts the next round after a 'round-over'. Positions, health, stamina and
   * power all reset; round wins and cumulative statistics carry over.
   */
  startNextRound(): void {
    if (this.state.phase !== 'round-over') return;
    if (this.state.boutWinner !== null) return;

    this.resetSide(this.red);
    this.resetSide(this.blue);

    this.state.round += 1;
    this.state.time = 0;
    this.state.timeRemaining = this.roundSeconds;
    this.state.phase = 'ready';
    this.state.roundWinner = null;
    this.state.roundEndReason = null;
    this.state.suddenDeath = false;
    this.warningFired = false;
    this.accumulator = 0;
  }

  /**
   * Advances by `elapsed` real seconds using a fixed internal step, so
   * behaviour does not change with frame rate.
   */
  advance(elapsed: number, redInput: MatchInput, blueInput: MatchInput): void {
    if (!Number.isFinite(elapsed) || elapsed <= 0) return;
    this.accumulator += Math.min(elapsed, MAX_STEP);
    let guard = 0;
    while (this.accumulator >= FIXED_STEP && guard < 8) {
      this.step(FIXED_STEP, redInput, blueInput);
      this.accumulator -= FIXED_STEP;
      guard += 1;
    }
    if (guard >= 8) this.accumulator = 0;
  }

  /** Advances by exactly `dt`. Exposed for deterministic tests and AI harnesses. */
  step(dt: number, redInput: MatchInput, blueInput: MatchInput): void {
    if (this.state.phase !== 'fighting') {
      this.red.previousInput = redInput;
      this.blue.previousInput = blueInput;
      return;
    }

    this.state.time += dt;
    this.state.timeRemaining = Math.max(0, this.state.timeRemaining - dt);

    if (
      !this.warningFired &&
      !this.state.suddenDeath &&
      this.state.timeRemaining <= TIME_WARNING_AT
    ) {
      this.warningFired = true;
      this.emit('time-warning');
    }

    this.updateSide(this.red, this.blue, redInput, dt);
    this.updateSide(this.blue, this.red, blueInput, dt);

    this.resolveSeparation();
    this.faceOpponents();

    this.red.previousInput = redInput;
    this.blue.previousInput = blueInput;

    this.checkRoundEnd();
  }

  // ── Per-fighter update ────────────────────────────────────────────────────

  private updateSide(side: Side, other: Side, input: MatchInput, dt: number): void {
    const sim = side.sim;
    side.timeSinceSpend += dt;

    if (sim.action === 'defeated') {
      this.applyPhysics(side, dt);
      return;
    }

    if (sim.action === 'knockdown') {
      side.knockdownTimer -= dt;
      this.applyPhysics(side, dt);
      if (side.knockdownTimer <= 0) {
        sim.action = 'idle';
        sim.phase = 'recover';
        sim.vx = 0;
      }
      return;
    }

    if (sim.hitstunRemaining > 0) {
      sim.hitstunRemaining -= dt;
      sim.action = 'hitstun';
      this.applyPhysics(side, dt);
      if (sim.hitstunRemaining <= 0) {
        sim.action = 'idle';
        sim.vx = 0;
      }
      return;
    }

    this.advanceAction(side, other, input, dt);
    this.handleInput(side, input);
    this.updateMovement(side, input, dt);
    this.updateResources(side, input, dt);
    this.applyPhysics(side, dt);

    sim.invulnerable =
      sim.action === 'dodge' &&
      sim.actionTime >= DODGE_WINDUP &&
      sim.actionTime < DODGE_WINDUP + DODGE_INVULNERABLE * side.profile.dodgeScale;
  }

  /** Advances a timed action and resolves its active window. */
  private advanceAction(side: Side, other: Side, input: MatchInput, dt: number): void {
    const sim = side.sim;
    if (sim.action === 'idle') return;

    if (sim.action === 'block') {
      // Held indefinitely; released in handleInput.
      sim.actionTime += dt;
      return;
    }

    sim.actionTime += dt;

    if (sim.action === 'dodge') {
      const scale = side.profile.dodgeScale;
      const total = (DODGE_WINDUP + DODGE_INVULNERABLE + DODGE_RECOVER) * scale;
      sim.phase =
        sim.actionTime < DODGE_WINDUP * scale
          ? 'windup'
          : sim.actionTime < (DODGE_WINDUP + DODGE_INVULNERABLE) * scale
            ? 'active'
            : 'recover';
      if (sim.phase === 'recover') sim.vx *= 0.82;
      if (sim.actionTime >= total) this.clearAction(side, input);
      return;
    }

    if (sim.action === 'attack' && sim.attack) {
      const spec = ATTACKS[sim.attack];
      const scale = sim.attack === 'powerAttack' ? 1 : side.profile.attackSpeedScale;
      const windup = spec.windup * scale;
      const active = spec.active * scale;
      const total = (spec.windup + spec.active + spec.recover) * scale;

      sim.phase =
        sim.actionTime < windup ? 'windup' : sim.actionTime < windup + active ? 'active' : 'recover';

      if (sim.phase === 'active' && !sim.attackConsumed) {
        this.resolveAttack(side, other, sim.attack);
      }

      if (sim.actionTime >= total) this.clearAction(side, input);
    }
  }

  private clearAction(side: Side, input: MatchInput): void {
    const sim = side.sim;
    sim.action = input.block && sim.grounded ? 'block' : 'idle';
    sim.phase = sim.action === 'block' ? 'active' : 'recover';
    sim.actionTime = 0;
    sim.actionDuration = 0;
    sim.attack = null;
    sim.attackConsumed = false;
    sim.invulnerable = false;
  }

  private canAct(sim: FighterSim): boolean {
    return sim.action === 'idle' || sim.action === 'block';
  }

  private handleInput(side: Side, input: MatchInput): void {
    const sim = side.sim;

    // Crouching is a held stance, only available on the ground and while free.
    sim.crouching = input.down && sim.grounded && this.canAct(sim);

    // Blocking is a held state entered and left freely while otherwise idle.
    if (sim.action === 'idle' && input.block && sim.grounded) {
      sim.action = 'block';
      sim.phase = 'active';
      sim.actionTime = 0;
    } else if (sim.action === 'block' && (!input.block || !sim.grounded)) {
      sim.action = 'idle';
      sim.phase = 'recover';
      sim.actionTime = 0;
    }

    if (!this.canAct(sim)) return;

    if (this.pressed(side, input, 'dodge') && sim.grounded) {
      const cost = DODGE_STAMINA * side.profile.dodgeScale;
      if (this.spendStamina(side, cost)) {
        sim.action = 'dodge';
        sim.phase = 'windup';
        sim.actionTime = 0;
        const direction = input.left ? -1 : input.right ? 1 : ((-sim.facing) as -1 | 1);
        sim.vx = direction * DODGE_SPEED;
      }
      return;
    }

    if (this.pressed(side, input, 'power') && sim.power >= POWER_ATTACK_COST) {
      if (this.startAttack(side, 'powerAttack')) {
        sim.power = 0;
        side.powerCueFired = false;
        sim.stats.powerMovesUsed += 1;
        this.emit('power-used', sim.corner);
      }
      return;
    }

    // Attack selection. Airborne attacks and crouching attacks take priority
    // over their standing equivalents so one button covers three situations.
    const attackId = this.chooseAttack(sim, input, side);
    if (attackId) {
      this.startAttack(side, attackId);
      return;
    }

    if (this.pressed(side, input, 'up') && sim.grounded && sim.action === 'idle') {
      sim.vy = side.profile.jumpVelocity;
      sim.grounded = false;
      sim.crouching = false;
      this.emit('jump', sim.corner);
    }
  }

  private chooseAttack(sim: FighterSim, input: MatchInput, side: Side): AttackId | null {
    const punchLight = this.pressed(side, input, 'lightPunch');
    const punchStrong = this.pressed(side, input, 'strongPunch');
    const kickLight = this.pressed(side, input, 'lightKick');
    const kickStrong = this.pressed(side, input, 'strongKick');
    if (!punchLight && !punchStrong && !kickLight && !kickStrong) return null;

    if (!sim.grounded) return 'jumpAttack';
    if (sim.crouching) return 'crouchAttack';
    if (punchStrong) return 'strongPunch';
    if (kickStrong) return 'strongKick';
    if (kickLight) return 'lightKick';
    return 'lightPunch';
  }

  private startAttack(side: Side, attackId: AttackId): boolean {
    const sim = side.sim;
    const spec = ATTACKS[attackId];
    if (!this.spendStamina(side, spec.stamina)) return false;

    sim.action = 'attack';
    sim.attack = attackId;
    sim.phase = 'windup';
    sim.actionTime = 0;
    sim.attackConsumed = false;
    const scale = attackId === 'powerAttack' ? 1 : side.profile.attackSpeedScale;
    sim.actionDuration = (spec.windup + spec.active + spec.recover) * scale;
    this.emit('attack-thrown', sim.corner, attackId);
    return true;
  }

  private pressed(side: Side, input: MatchInput, key: keyof MatchInput): boolean {
    return input[key] && !side.previousInput[key];
  }

  private spendStamina(side: Side, amount: number): boolean {
    const sim = side.sim;
    if (sim.stamina < amount) {
      this.emit('exhausted', sim.corner);
      return false;
    }
    sim.stamina -= amount;
    side.timeSinceSpend = 0;
    return true;
  }

  private updateMovement(side: Side, input: MatchInput, dt: number): void {
    const sim = side.sim;

    if (sim.action === 'dodge') {
      // Velocity was set on entry and decays in advanceAction.
    } else if (sim.action === 'idle' || sim.action === 'block') {
      const axis = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const scale = sim.action === 'block' ? BLOCK_MOVE_SCALE : sim.crouching ? CROUCH_MOVE_SCALE : 1;
      // Air control is limited: momentum from the jump mostly carries.
      if (sim.grounded) {
        sim.vx = axis * side.profile.moveSpeed * scale;
        sim.moving = axis !== 0;
      } else {
        sim.vx += axis * side.profile.moveSpeed * 1.2 * dt;
        sim.moving = false;
      }
    } else {
      if (sim.grounded) sim.vx = 0;
      sim.moving = false;
    }
  }

  private applyPhysics(side: Side, dt: number): void {
    const sim = side.sim;
    sim.x += sim.vx * dt;

    const minX = WALL_MARGIN + FIGHTER_HALF_WIDTH;
    const maxX = ARENA_WIDTH - WALL_MARGIN - FIGHTER_HALF_WIDTH;
    if (sim.x < minX) {
      sim.x = minX;
      if (sim.vx < 0) sim.vx = 0;
    } else if (sim.x > maxX) {
      sim.x = maxX;
      if (sim.vx > 0) sim.vx = 0;
    }

    if (!sim.grounded) {
      sim.vy -= GRAVITY * dt;
      sim.y += sim.vy * dt;
      if (sim.y <= 0) {
        sim.y = 0;
        sim.vy = 0;
        sim.grounded = true;
        sim.vx = 0;
      }
    }

    // Knockback and hitstun slide decays on the ground.
    if (sim.grounded && (sim.action === 'hitstun' || sim.action === 'knockdown')) {
      sim.vx *= 0.86;
      if (Math.abs(sim.vx) < 4) sim.vx = 0;
    }
  }

  private updateResources(side: Side, input: MatchInput, dt: number): void {
    const sim = side.sim;

    if (sim.action === 'block') {
      sim.stamina = Math.max(0, sim.stamina - side.profile.blockDrain * dt);
      side.timeSinceSpend = 0;
      // A broken guard drops the block rather than trapping the fighter.
      if (sim.stamina <= 0) {
        sim.action = 'idle';
        sim.phase = 'recover';
      }
    } else if (side.timeSinceSpend >= STAMINA_REGEN_DELAY) {
      const bonus = !input.left && !input.right && sim.grounded ? STAMINA_IDLE_BONUS : 1;
      sim.stamina = Math.min(sim.maxStamina, sim.stamina + side.profile.staminaRegen * bonus * dt);
    }

    if (sim.power >= POWER_ATTACK_COST && !side.powerCueFired) {
      side.powerCueFired = true;
      this.emit('power-ready', sim.corner);
    }
  }

  /** Fighters cannot occupy the same space; push them apart symmetrically. */
  private resolveSeparation(): void {
    const a = this.red.sim;
    const b = this.blue.sim;
    // Airborne fighters pass over each other; only grounded bodies collide.
    if (!a.grounded && !b.grounded) return;

    const gap = b.x - a.x;
    const distance = Math.abs(gap);
    if (distance >= MIN_SEPARATION) return;

    const overlap = (MIN_SEPARATION - distance) / 2;
    const direction = gap >= 0 ? 1 : -1;
    a.x -= overlap * direction;
    b.x += overlap * direction;

    const minX = WALL_MARGIN + FIGHTER_HALF_WIDTH;
    const maxX = ARENA_WIDTH - WALL_MARGIN - FIGHTER_HALF_WIDTH;
    a.x = Math.max(minX, Math.min(maxX, a.x));
    b.x = Math.max(minX, Math.min(maxX, b.x));
  }

  /** Fighters always face each other unless committed to an action. */
  private faceOpponents(): void {
    const a = this.red.sim;
    const b = this.blue.sim;
    if (this.canAct(a)) a.facing = b.x >= a.x ? 1 : -1;
    if (this.canAct(b)) b.facing = a.x >= b.x ? 1 : -1;
  }

  // ── Attack resolution ─────────────────────────────────────────────────────

  private resolveAttack(side: Side, other: Side, attackId: AttackId): void {
    const attacker = side.sim;
    const defender = other.sim;
    attacker.attackConsumed = true;

    if (defender.action === 'defeated') return;

    const spec = ATTACKS[attackId];
    const reach = spec.reach + side.profile.reachBonus;
    const gap = defender.x - attacker.x;

    // The defender must be in front of the attacker and within reach.
    if (Math.sign(gap) !== attacker.facing && gap !== 0) return;
    if (Math.abs(gap) > reach + FIGHTER_HALF_WIDTH) return;

    // Vertical band check: does the attack cover where the defender actually is?
    const attackLow = attacker.y + spec.lowEdge * FIGHTER_HEIGHT;
    const attackHigh = attacker.y + spec.highEdge * FIGHTER_HEIGHT;
    const defenderLow = defender.y;
    const defenderHigh = defender.y + (defender.crouching ? CROUCH_HEIGHT : FIGHTER_HEIGHT);
    if (attackHigh < defenderLow || attackLow > defenderHigh) return;

    const impactX = attacker.x + attacker.facing * reach * 0.8;
    const impactY = Math.max(attackLow, defenderLow) + 20;

    // 1. Evasion frames beat everything.
    if (defender.invulnerable) {
      defender.stats.dodgesSucceeded += 1;
      defender.power = Math.min(defender.maxPower, defender.power + POWER_ON_DODGE);
      this.emit('dodged', defender.corner, attackId, undefined, impactX, impactY);
      return;
    }

    const rawDamage =
      spec.damage *
      side.profile.damageScale *
      other.profile.toughness *
      (attackId === 'powerAttack' ? side.fighter.specialAbility.damageScale : 1);

    // 2. Guard check. Standing guards stop high attacks; crouching guards stop
    //    low attacks; jump attacks beat a crouching guard.
    if (defender.action === 'block') {
      const guardHolds = spec.lowAttack
        ? defender.crouching
        : !(defender.crouching && attackId === 'jumpAttack');

      const multiplier = guardHolds ? BLOCK_DAMAGE_MULTIPLIER : GUARD_BREAK_MULTIPLIER;
      const damage = rawDamage * multiplier;

      this.applyDamage(other, damage);
      defender.stamina = Math.max(0, defender.stamina - BLOCK_IMPACT_STAMINA);
      other.timeSinceSpend = 0;
      defender.stats.attacksBlocked += 1;
      defender.hitstunRemaining = Math.max(defender.hitstunRemaining, BLOCK_HITSTUN);
      defender.vx = attacker.facing * spec.knockback * 0.25;

      attacker.power = Math.min(attacker.maxPower, attacker.power + spec.powerOnBlocked);
      defender.power = Math.min(defender.maxPower, defender.power + spec.powerOnBlocked);
      attacker.stats.damageDealt += damage;

      this.emit('blocked', attacker.corner, attackId, damage, impactX, impactY);
      this.checkDefeat(other, side);
      return;
    }

    // 3. Clean contact.
    this.applyDamage(other, rawDamage);
    defender.hitstunRemaining = spec.hitstun;
    defender.action = 'hitstun';
    defender.attack = null;
    defender.vx = attacker.facing * spec.knockback;
    defender.crouching = false;

    attacker.power = Math.min(attacker.maxPower, attacker.power + spec.powerOnHit);
    defender.power = Math.min(
      defender.maxPower,
      defender.power + rawDamage * POWER_ON_DAMAGE_TAKEN,
    );

    attacker.stats.damageDealt += rawDamage;
    if (PUNCHES.has(attackId)) attacker.stats.punchesLanded += 1;
    if (KICKS.has(attackId)) attacker.stats.kicksLanded += 1;
    if (STRONG.has(attackId)) attacker.stats.strongAttacksLanded += 1;

    this.emit('hit', attacker.corner, attackId, rawDamage, impactX, impactY);
    this.checkDefeat(other, side);
  }

  private applyDamage(side: Side, amount: number): void {
    const sim = side.sim;
    sim.health = Math.max(0, sim.health - amount);
    sim.stats.damageTaken += amount;
  }

  private checkDefeat(loser: Side, winner: Side): void {
    if (loser.sim.health > 0 || loser.sim.action === 'defeated') return;

    loser.sim.action = 'knockdown';
    loser.sim.phase = 'recover';
    loser.sim.attack = null;
    loser.sim.hitstunRemaining = 0;
    loser.knockdownTimer = KNOCKDOWN_TIME;
    winner.sim.stats.knockouts += 1;

    this.emit('knockdown', loser.sim.corner);
    this.endRound(winner.sim.corner, 'knockout');
  }

  // ── Round and bout resolution ─────────────────────────────────────────────

  private checkRoundEnd(): void {
    if (this.state.phase !== 'fighting') return;
    if (this.state.timeRemaining > 0) return;

    const redRatio = this.red.sim.health / this.red.sim.maxHealth;
    const blueRatio = this.blue.sim.health / this.blue.sim.maxHealth;
    const difference = Math.abs(redRatio - blueRatio);

    // A dead-level round goes to a short sudden-death extension rather than
    // being recorded as a draw. A draw is only possible if that also ends level.
    if (difference < 0.001) {
      if (!this.state.suddenDeath) {
        this.state.suddenDeath = true;
        this.state.timeRemaining = SUDDEN_DEATH_SECONDS;
        return;
      }
      this.endRound('draw', 'draw');
      return;
    }

    this.endRound(redRatio > blueRatio ? 'red' : 'blue', 'timeout');
  }

  private endRound(winner: Corner | 'draw', reason: 'knockout' | 'timeout' | 'draw'): void {
    if (this.state.phase === 'round-over' || this.state.phase === 'bout-over') return;

    this.state.phase = 'round-over';
    this.state.roundWinner = winner;
    this.state.roundEndReason = reason;

    if (winner === 'red') this.red.sim.roundWins += 1;
    else if (winner === 'blue') this.blue.sim.roundWins += 1;

    if (reason === 'knockout') this.emit('knockout', winner === 'draw' ? undefined : winner);
    this.emit('round-end', winner === 'draw' ? undefined : winner);

    const redWins = this.red.sim.roundWins;
    const blueWins = this.blue.sim.roundWins;
    const roundsPlayed = this.state.round;

    if (redWins >= ROUNDS_TO_WIN_BOUT || blueWins >= ROUNDS_TO_WIN_BOUT) {
      this.finishBout(redWins > blueWins ? 'red' : 'blue');
      return;
    }

    if (roundsPlayed >= MAX_ROUNDS) {
      // All rounds used. Round wins decide; if still level, remaining health does.
      if (redWins !== blueWins) {
        this.finishBout(redWins > blueWins ? 'red' : 'blue');
      } else {
        const redRatio = this.red.sim.health / this.red.sim.maxHealth;
        const blueRatio = this.blue.sim.health / this.blue.sim.maxHealth;
        // An exactly level bout goes to the fighter who landed more damage,
        // which cannot itself tie in practice; red is the final fallback.
        const decider =
          redRatio !== blueRatio
            ? redRatio > blueRatio
            : this.red.sim.stats.damageDealt >= this.blue.sim.stats.damageDealt;
        this.finishBout(decider ? 'red' : 'blue');
      }
    }
  }

  private finishBout(winner: Corner): void {
    this.state.phase = 'bout-over';
    this.state.boutWinner = winner;
    const loser = winner === 'red' ? this.blue : this.red;
    loser.sim.action = 'defeated';
    this.emit('bout-end', winner);
  }

  private resetSide(side: Side): void {
    const sim = side.sim;
    const centre = ARENA_WIDTH / 2;
    sim.x = sim.corner === 'red' ? centre - START_OFFSET : centre + START_OFFSET;
    sim.y = 0;
    sim.vx = 0;
    sim.vy = 0;
    sim.facing = sim.corner === 'red' ? 1 : -1;
    sim.grounded = true;
    sim.crouching = false;
    sim.moving = false;
    sim.health = sim.maxHealth;
    sim.stamina = sim.maxStamina;
    sim.power = 0;
    sim.action = 'idle';
    sim.phase = 'recover';
    sim.actionTime = 0;
    sim.actionDuration = 0;
    sim.attack = null;
    sim.attackConsumed = false;
    sim.invulnerable = false;
    sim.hitstunRemaining = 0;
    side.timeSinceSpend = STAMINA_REGEN_DELAY;
    side.knockdownTimer = 0;
    side.powerCueFired = false;
    side.previousInput = NEUTRAL_MATCH_INPUT;
  }

  private emit(
    type: MatchEventType,
    corner?: Corner,
    attack?: AttackId,
    damage?: number,
    x?: number,
    y?: number,
  ): void {
    this.events.push({
      type,
      ...(corner ? { corner } : {}),
      ...(attack ? { attack } : {}),
      ...(damage !== undefined ? { damage } : {}),
      ...(x !== undefined ? { x } : {}),
      ...(y !== undefined ? { y } : {}),
      at: this.state.time,
    });
  }
}

/** Re-exported so renderers can size themselves without importing constants. */
export { ARENA_WIDTH, ARENA_HEIGHT };
