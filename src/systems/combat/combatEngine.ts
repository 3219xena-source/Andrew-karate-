/**
 * Stage 1 combat engine.
 *
 * A deterministic fixed-step state machine for one player-controlled fighter
 * and one practice pad. It owns movement, facing, light and strong attacks,
 * blocking, dodging, stamina, cooldowns, hit detection and reaction states, and
 * emits an event stream that the tutorial and audio systems consume.
 *
 * Deliberately NOT included in Stage 1 (see docs/KNOWN_LIMITATIONS.md):
 * opponent AI, health or damage, rounds, referee rules and scoring. The struct
 * is shaped so a second `FighterState` driven by an AI controller can be added
 * without reworking the rules below.
 *
 * Presentation contract: this is a sport karate simulation. Contact is scored,
 * never injurious — there is no health, no damage, no knockdown and no injury
 * state. A practice strike that is not blocked or evaded produces a brief
 * guard-reset stagger and nothing more.
 */

import type { Fighter } from '../../types/fighter.ts';
import {
  ACTION_TIMING,
  ARENA_WIDTH,
  ATTACK_REACH,
  COMBO_WINDOW,
  DODGE_SPEED,
  FIGHTER_HALF_WIDTH,
  FIXED_STEP,
  GRAVITY,
  MARK_RADIUS,
  MARK_X,
  MAX_STEP,
  PAD_ACTIVE_TIME,
  PAD_HALF_WIDTH,
  PAD_RECOVER_TIME,
  PAD_STRIKE_REACH,
  PAD_TELEGRAPH_TIME,
  PAD_X,
  STAMINA_COST,
  STAMINA_LOW_RATIO,
  STAMINA_RECOVERED_RATIO,
  STAMINA_REGEN_DELAY,
  START_X,
  WALL_MARGIN,
} from './constants.ts';
import {
  NEUTRAL_INPUT,
  type ActionName,
  type AttackPower,
  type CombatEvent,
  type CombatEventType,
  type CombatProfile,
  type CombatState,
  type InputState,
} from './types.ts';

/**
 * Derives per-fighter handling from authored ratings.
 *
 * Stage 1 limitation: named special abilities are descriptive only. Ratings —
 * not abilities — drive handling, so every fighter shares one moveset with
 * different speed, stamina and guard characteristics.
 */
export function deriveCombatProfile(fighter: Fighter | null | undefined): CombatProfile {
  const stats = fighter?.stats ?? {
    strength: 70,
    speed: 70,
    defence: 70,
    technique: 70,
    stamina: 70,
  };
  return {
    moveSpeed: 190 + stats.speed * 1.25,
    jumpVelocity: 780 + stats.speed * 1.4,
    staminaMax: 78 + stats.stamina * 0.62,
    staminaRegen: 11 + stats.stamina * 0.13,
    blockDrain: Math.max(6, 19 - stats.defence * 0.09),
    attackSpeedScale: 1.18 - stats.technique / 420,
    dodgeScale: 1.16 - stats.speed / 460,
  };
}

function createFighterState(profile: CombatProfile): CombatState['fighter'] {
  return {
    x: START_X,
    y: 0,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: true,
    action: 'idle',
    phase: 'recover',
    actionTime: 0,
    actionDuration: 0,
    stamina: profile.staminaMax,
    staminaMax: profile.staminaMax,
    invulnerable: false,
    attackConsumed: false,
    moving: false,
  };
}

function createPadState(): CombatState['pad'] {
  return {
    x: PAD_X,
    phase: 'idle',
    phaseTime: 0,
    striking: false,
    strikeResolved: false,
    recoil: 0,
  };
}

export class CombatEngine {
  private state: CombatState;
  private profile: CombatProfile;
  private previousInput: InputState = NEUTRAL_INPUT;
  private events: CombatEvent[] = [];
  private timeSinceSpend = STAMINA_REGEN_DELAY;
  private accumulator = 0;

  constructor(fighter?: Fighter | null) {
    this.profile = deriveCombatProfile(fighter);
    this.state = {
      time: 0,
      fighter: createFighterState(this.profile),
      pad: createPadState(),
      distanceLeft: 0,
      distanceRight: 0,
      comboWindow: [],
      staminaWasLow: false,
    };
  }

  /** Read-only view of the current simulation state. */
  getState(): Readonly<CombatState> {
    return this.state;
  }

  getProfile(): Readonly<CombatProfile> {
    return this.profile;
  }

  /** Stamina as a 0..1 ratio, safe against a zero maximum. */
  getStaminaRatio(): number {
    const { stamina, staminaMax } = this.state.fighter;
    if (staminaMax <= 0) return 0;
    return Math.max(0, Math.min(1, stamina / staminaMax));
  }

  /** True while the fighter stands inside the tutorial's marked training area. */
  isOnMark(): boolean {
    return Math.abs(this.state.fighter.x - MARK_X) <= MARK_RADIUS;
  }

  /** Instructs the pad to begin or stop throwing practice strikes. */
  setPadStriking(striking: boolean): void {
    const pad = this.state.pad;
    pad.striking = striking;
    if (!striking && pad.phase !== 'idle') {
      pad.phase = 'idle';
      pad.phaseTime = 0;
      pad.strikeResolved = false;
    }
  }

  /** Returns the buffered events and clears the buffer. */
  drainEvents(): CombatEvent[] {
    if (this.events.length === 0) return [];
    const drained = this.events;
    this.events = [];
    return drained;
  }

  /** Returns the fighter to the starting mark and clears all action state. */
  resetPosition(): void {
    const fighter = this.state.fighter;
    fighter.x = START_X;
    fighter.y = 0;
    fighter.vx = 0;
    fighter.vy = 0;
    fighter.facing = 1;
    fighter.grounded = true;
    fighter.stamina = this.profile.staminaMax;
    this.clearAction();
    this.state.comboWindow = [];
    this.state.pad.phase = 'idle';
    this.state.pad.phaseTime = 0;
    this.state.pad.strikeResolved = false;
    this.timeSinceSpend = STAMINA_REGEN_DELAY;
  }

  /**
   * Advances the simulation by `elapsed` real seconds using a fixed internal
   * step, so behaviour does not change with frame rate. Oversized frames — a
   * backgrounded tab, a slow first paint — are clamped rather than simulated.
   */
  advance(elapsed: number, input: InputState): void {
    if (!Number.isFinite(elapsed) || elapsed <= 0) {
      this.previousInput = input;
      return;
    }
    this.accumulator += Math.min(elapsed, MAX_STEP);
    let guard = 0;
    while (this.accumulator >= FIXED_STEP && guard < 8) {
      this.step(FIXED_STEP, input);
      this.accumulator -= FIXED_STEP;
      guard += 1;
    }
    if (guard >= 8) {
      // Simulation fell too far behind to catch up; drop the backlog rather
      // than spiralling. Visible as a small hitch, never as a frozen tab.
      this.accumulator = 0;
    }
  }

  /**
   * Advances the simulation by exactly `dt` seconds. Exposed for tests, which
   * drive the engine deterministically without a render loop.
   */
  step(dt: number, input: InputState): void {
    const state = this.state;
    const fighter = state.fighter;

    state.time += dt;
    this.timeSinceSpend += dt;

    this.updateAction(dt, input);
    this.handleInput(input);
    this.updateMovement(dt, input);
    this.updateStamina(dt, input);
    this.updatePad(dt);
    this.expireCombo();

    if (state.pad.recoil > 0) {
      state.pad.recoil = Math.max(0, state.pad.recoil - dt * 3.2);
    }

    fighter.invulnerable = fighter.action === 'dodge' && fighter.phase === 'active';
    this.previousInput = input;
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private emit(type: CombatEventType, power?: AttackPower): void {
    this.events.push(power ? { type, power, at: this.state.time } : { type, at: this.state.time });
  }

  private pressed(key: keyof InputState, input: InputState): boolean {
    return input[key] && !this.previousInput[key];
  }

  private clearAction(): void {
    const fighter = this.state.fighter;
    fighter.action = 'idle';
    fighter.phase = 'recover';
    fighter.actionTime = 0;
    fighter.actionDuration = 0;
    fighter.attackConsumed = false;
    fighter.invulnerable = false;
  }

  /** True when the fighter is free to begin a new action. */
  private canAct(): boolean {
    const fighter = this.state.fighter;
    return fighter.action === 'idle' || fighter.action === 'block';
  }

  private scaledTiming(action: Exclude<ActionName, 'idle' | 'block'>): {
    windup: number;
    active: number;
    total: number;
  } {
    const timing = ACTION_TIMING[action];
    const scale =
      action === 'dodge'
        ? this.profile.dodgeScale
        : action === 'stagger' || action === 'bow'
          ? 1
          : this.profile.attackSpeedScale;
    const windup = timing.windup * scale;
    const active = timing.active * scale;
    const recover = timing.recover * scale;
    return { windup, active, total: windup + active + recover };
  }

  private beginAction(action: Exclude<ActionName, 'idle' | 'block'>): void {
    const fighter = this.state.fighter;
    const { total } = this.scaledTiming(action);
    fighter.action = action;
    fighter.phase = 'windup';
    fighter.actionTime = 0;
    fighter.actionDuration = total;
    fighter.attackConsumed = false;
  }

  private spendStamina(amount: number): boolean {
    const fighter = this.state.fighter;
    if (fighter.stamina < amount) {
      this.emit('exhausted');
      return false;
    }
    fighter.stamina -= amount;
    this.timeSinceSpend = 0;
    return true;
  }

  private handleInput(input: InputState): void {
    const fighter = this.state.fighter;

    // Blocking is a held state, entered and left freely while otherwise idle.
    if (fighter.action === 'idle' && input.block && fighter.grounded) {
      fighter.action = 'block';
      fighter.phase = 'active';
      fighter.actionTime = 0;
      fighter.actionDuration = 0;
    } else if (fighter.action === 'block' && (!input.block || !fighter.grounded)) {
      this.clearAction();
    }

    if (!this.canAct()) return;

    if (this.pressed('dodge', input) && fighter.grounded) {
      if (this.spendStamina(STAMINA_COST.dodge * this.profile.dodgeScale)) {
        this.beginAction('dodge');
        const direction = input.left ? -1 : input.right ? 1 : (-fighter.facing as -1 | 1);
        fighter.vx = direction * DODGE_SPEED;
        this.emit('dodge');
      }
      return;
    }

    if (this.pressed('strong', input)) {
      if (this.spendStamina(STAMINA_COST.strong)) this.beginAction('strong');
      return;
    }

    if (this.pressed('light', input)) {
      if (this.spendStamina(STAMINA_COST.light)) this.beginAction('light');
      return;
    }

    if (this.pressed('bow', input) && fighter.grounded && !fighter.moving) {
      this.beginAction('bow');
      this.emit('bow');
      return;
    }

    if (this.pressed('jump', input) && fighter.grounded && fighter.action === 'idle') {
      fighter.vy = this.profile.jumpVelocity;
      fighter.grounded = false;
      this.emit('jump');
    }
  }

  private updateAction(dt: number, input: InputState): void {
    const fighter = this.state.fighter;
    if (fighter.action === 'idle') return;

    if (fighter.action === 'block') {
      // Held indefinitely; released in handleInput.
      fighter.actionTime += dt;
      return;
    }

    fighter.actionTime += dt;
    const timing = this.scaledTiming(fighter.action);
    const previousPhase = fighter.phase;

    if (fighter.actionTime < timing.windup) {
      fighter.phase = 'windup';
    } else if (fighter.actionTime < timing.windup + timing.active) {
      fighter.phase = 'active';
    } else {
      fighter.phase = 'recover';
    }

    if (
      (fighter.action === 'light' || fighter.action === 'strong') &&
      fighter.phase === 'active' &&
      !fighter.attackConsumed
    ) {
      this.resolveAttack(fighter.action);
    }

    if (previousPhase !== 'recover' && fighter.phase === 'recover' && fighter.action === 'dodge') {
      fighter.vx = 0;
    }

    if (fighter.actionTime >= fighter.actionDuration) {
      const wasBlocking = input.block && fighter.grounded;
      this.clearAction();
      if (wasBlocking) {
        fighter.action = 'block';
        fighter.phase = 'active';
      }
    }
  }

  private resolveAttack(power: AttackPower): void {
    const fighter = this.state.fighter;
    fighter.attackConsumed = true;

    // The technique sweeps the space between the fighter's front edge and the
    // limit of its reach, rather than testing a single point. A player standing
    // at light-attack distance can therefore also land a longer strong attack,
    // which is what the tutorial's combination drill requires.
    const reach = ATTACK_REACH[power];
    const near = fighter.x + fighter.facing * FIGHTER_HALF_WIDTH;
    const far = fighter.x + fighter.facing * reach;
    const sweepLeft = Math.min(near, far);
    const sweepRight = Math.max(near, far);

    const padLeft = this.state.pad.x - PAD_HALF_WIDTH;
    const padRight = this.state.pad.x + PAD_HALF_WIDTH;
    const overlapsPad = sweepRight >= padLeft && sweepLeft <= padRight;
    // A technique thrown from the far side of the pad should not connect.
    const facingPad = Math.sign(this.state.pad.x - fighter.x) === fighter.facing;

    if (!overlapsPad || !facingPad) return;

    this.state.pad.recoil = power === 'strong' ? 1 : 0.6;
    this.emit('hit', power);
    this.registerComboHit(power);
  }

  private registerComboHit(power: AttackPower): void {
    const window = this.state.comboWindow;
    window.push({ power, at: this.state.time });
    if (window.length > 4) window.shift();

    // A basic combination is light → light → strong, each landing inside the
    // combination window. Stage 2 replaces this with a data-driven combo table.
    if (window.length >= 3) {
      const [a, b, c] = window.slice(-3);
      if (
        a &&
        b &&
        c &&
        a.power === 'light' &&
        b.power === 'light' &&
        c.power === 'strong' &&
        c.at - a.at <= COMBO_WINDOW * 2 &&
        b.at - a.at <= COMBO_WINDOW &&
        c.at - b.at <= COMBO_WINDOW
      ) {
        this.emit('combo');
        this.state.comboWindow = [];
      }
    }
  }

  private expireCombo(): void {
    const cutoff = this.state.time - COMBO_WINDOW;
    while (this.state.comboWindow.length > 0 && (this.state.comboWindow[0]?.at ?? 0) < cutoff) {
      this.state.comboWindow.shift();
    }
  }

  private updateMovement(dt: number, input: InputState): void {
    const fighter = this.state.fighter;
    const canWalk = fighter.action === 'idle' || fighter.action === 'block';
    const walkScale = fighter.action === 'block' ? 0.45 : 1;

    if (fighter.action === 'dodge') {
      // Dodge velocity is set on entry and decays in updateAction.
    } else if (canWalk) {
      const axis = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      fighter.vx = axis * this.profile.moveSpeed * walkScale;
      fighter.moving = axis !== 0;
      if (axis !== 0 && fighter.action !== 'block') {
        fighter.facing = axis > 0 ? 1 : -1;
      }
    } else {
      fighter.vx = 0;
      fighter.moving = false;
    }

    const previousX = fighter.x;
    fighter.x += fighter.vx * dt;

    const minX = WALL_MARGIN + FIGHTER_HALF_WIDTH;
    const maxX = ARENA_WIDTH - WALL_MARGIN - FIGHTER_HALF_WIDTH;
    fighter.x = Math.max(minX, Math.min(maxX, fighter.x));

    const delta = fighter.x - previousX;
    if (delta > 0) this.state.distanceRight += delta;
    else if (delta < 0) this.state.distanceLeft += -delta;

    if (!fighter.grounded) {
      fighter.vy -= GRAVITY * dt;
      fighter.y += fighter.vy * dt;
      if (fighter.y <= 0) {
        fighter.y = 0;
        fighter.vy = 0;
        fighter.grounded = true;
      }
    }
  }

  private updateStamina(dt: number, input: InputState): void {
    const fighter = this.state.fighter;

    if (fighter.action === 'block') {
      fighter.stamina = Math.max(0, fighter.stamina - this.profile.blockDrain * dt);
      this.timeSinceSpend = 0;
      if (fighter.stamina <= 0) {
        // Guard breaks rather than locking the player into an unusable state.
        this.clearAction();
      }
    } else if (this.timeSinceSpend >= STAMINA_REGEN_DELAY) {
      const idleBonus = !input.left && !input.right && fighter.grounded ? 1.35 : 1;
      fighter.stamina = Math.min(
        fighter.staminaMax,
        fighter.stamina + this.profile.staminaRegen * idleBonus * dt,
      );
    }

    const ratio = this.getStaminaRatio();
    if (!this.state.staminaWasLow && ratio <= STAMINA_LOW_RATIO) {
      this.state.staminaWasLow = true;
      this.emit('stamina-low');
    } else if (this.state.staminaWasLow && ratio >= STAMINA_RECOVERED_RATIO) {
      this.state.staminaWasLow = false;
      this.emit('stamina-recovered');
    }
  }

  private updatePad(dt: number): void {
    const pad = this.state.pad;
    if (!pad.striking) return;

    pad.phaseTime += dt;

    switch (pad.phase) {
      case 'idle':
        pad.phase = 'telegraph';
        pad.phaseTime = 0;
        pad.strikeResolved = false;
        this.emit('strike-telegraph');
        break;

      case 'telegraph':
        if (pad.phaseTime >= PAD_TELEGRAPH_TIME) {
          pad.phase = 'active';
          pad.phaseTime = 0;
          pad.strikeResolved = false;
        }
        break;

      case 'active':
        if (!pad.strikeResolved) this.resolvePadStrike();
        if (pad.phaseTime >= PAD_ACTIVE_TIME) {
          pad.phase = 'recover';
          pad.phaseTime = 0;
        }
        break;

      case 'recover':
        if (pad.phaseTime >= PAD_RECOVER_TIME) {
          pad.phase = 'telegraph';
          pad.phaseTime = 0;
          pad.strikeResolved = false;
          this.emit('strike-telegraph');
        }
        break;
    }
  }

  /**
   * Resolves one practice strike against the player. Order matters: evasion is
   * checked before the guard, so a well-timed dodge always reads as a dodge.
   */
  private resolvePadStrike(): void {
    const pad = this.state.pad;
    const fighter = this.state.fighter;
    const distance = Math.abs(fighter.x - pad.x);

    if (distance > PAD_STRIKE_REACH) {
      // Out of range entirely; the strike simply misses and is not a lesson.
      pad.strikeResolved = true;
      return;
    }

    pad.strikeResolved = true;

    if (fighter.invulnerable) {
      this.emit('evade');
      return;
    }

    if (fighter.action === 'block') {
      fighter.stamina = Math.max(0, fighter.stamina - STAMINA_COST.blockImpact);
      this.timeSinceSpend = 0;
      this.emit('block');
      return;
    }

    // Light contact only: a brief guard reset. No damage, no injury state.
    this.clearAction();
    this.beginAction('stagger');
    fighter.vx = 0;
    this.emit('strike-contact');
  }
}
