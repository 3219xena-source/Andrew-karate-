/**
 * Combat engine.
 *
 * The engine is pure and deterministic, so these tests drive it directly with
 * fixed steps — no canvas, no React, no timers.
 */

import { describe, expect, it } from 'vitest';
import { getFighter } from '../data/fighters.ts';
import { CombatEngine, deriveCombatProfile } from '../systems/combat/combatEngine.ts';
import {
  ARENA_WIDTH,
  MARK_X,
  PAD_X,
  STAMINA_COST,
  START_X,
} from '../systems/combat/constants.ts';
import { NEUTRAL_INPUT, type CombatEventType, type InputState } from '../systems/combat/types.ts';

const STEP = 1 / 120;

function input(overrides: Partial<InputState>): InputState {
  return { ...NEUTRAL_INPUT, ...overrides };
}

/** Advances the engine for `seconds` with a constant input. */
function run(engine: CombatEngine, seconds: number, held: Partial<InputState> = {}): void {
  const frames = Math.round(seconds / STEP);
  for (let i = 0; i < frames; i += 1) engine.step(STEP, input(held));
}

/** Presses a key for one frame, then holds neutral for `release` seconds. */
function tap(engine: CombatEngine, key: keyof InputState, release = 0.5): void {
  engine.step(STEP, input({ [key]: true } as Partial<InputState>));
  run(engine, release);
}

function typesOf(engine: CombatEngine): CombatEventType[] {
  return engine.drainEvents().map((event) => event.type);
}

/** Walks the fighter to within striking range of the pad. */
function approachPad(engine: CombatEngine): void {
  for (let i = 0; i < 2000; i += 1) {
    if (engine.getState().fighter.x >= PAD_X - 80) break;
    engine.step(STEP, input({ right: true }));
  }
  run(engine, 0.1);
  engine.drainEvents();
}

describe('combat profile', () => {
  it('derives handling from the fighter’s ratings', () => {
    const ales = deriveCombatProfile(getFighter('ales-gillian'));
    const graham = deriveCombatProfile(getFighter('mr-graham'));

    // Ales is rated faster; Mr Graham is rated as the better defender.
    expect(ales.moveSpeed).toBeGreaterThan(graham.moveSpeed);
    expect(graham.blockDrain).toBeLessThan(ales.blockDrain);
  });

  it('falls back to neutral handling when no fighter is supplied', () => {
    const profile = deriveCombatProfile(null);
    expect(profile.moveSpeed).toBeGreaterThan(0);
    expect(profile.staminaMax).toBeGreaterThan(0);
  });
});

describe('movement', () => {
  it('moves right and faces right', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    run(engine, 0.5, { right: true });
    const state = engine.getState();
    expect(state.fighter.x).toBeGreaterThan(START_X);
    expect(state.fighter.facing).toBe(1);
    expect(state.distanceRight).toBeGreaterThan(0);
  });

  it('moves left and faces left', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    run(engine, 0.5, { left: true });
    const state = engine.getState();
    expect(state.fighter.x).toBeLessThan(START_X);
    expect(state.fighter.facing).toBe(-1);
    expect(state.distanceLeft).toBeGreaterThan(0);
  });

  it('keeps the fighter inside the arena', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    run(engine, 12, { left: true });
    expect(engine.getState().fighter.x).toBeGreaterThan(0);
    run(engine, 20, { right: true });
    expect(engine.getState().fighter.x).toBeLessThan(ARENA_WIDTH);
  });

  it('reports standing on the training mark', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    expect(engine.isOnMark()).toBe(false);
    for (let i = 0; i < 2000; i += 1) {
      if (engine.isOnMark()) break;
      engine.step(STEP, input({ right: true }));
    }
    expect(engine.isOnMark()).toBe(true);
    expect(Math.abs(engine.getState().fighter.x - MARK_X)).toBeLessThan(60);
  });

  it('jumps and returns to the floor', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    engine.step(STEP, input({ jump: true }));
    expect(typesOf(engine)).toContain('jump');
    run(engine, 0.15);
    expect(engine.getState().fighter.y).toBeGreaterThan(0);
    run(engine, 2);
    expect(engine.getState().fighter.grounded).toBe(true);
    expect(engine.getState().fighter.y).toBe(0);
  });

  it('resets the fighter to the starting position', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    run(engine, 1, { right: true });
    engine.resetPosition();
    const state = engine.getState();
    expect(state.fighter.x).toBe(START_X);
    expect(state.fighter.action).toBe('idle');
    expect(state.fighter.stamina).toBe(state.fighter.staminaMax);
  });
});

describe('attacks', () => {
  it('lands a light attack on the practice pad', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    approachPad(engine);
    tap(engine, 'light');
    const events = engine.drainEvents();
    const hit = events.find((event) => event.type === 'hit');
    expect(hit?.power).toBe('light');
  });

  it('lands a strong attack on the practice pad', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    approachPad(engine);
    tap(engine, 'strong', 1);
    const events = engine.drainEvents();
    const hit = events.find((event) => event.type === 'hit');
    expect(hit?.power).toBe('strong');
  });

  it('does not connect when the pad is out of reach', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    engine.drainEvents();
    tap(engine, 'light');
    expect(typesOf(engine)).not.toContain('hit');
  });

  it('does not connect when facing away from the pad', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    approachPad(engine);
    run(engine, 0.2, { left: true });
    engine.drainEvents();
    tap(engine, 'light');
    expect(typesOf(engine)).not.toContain('hit');
  });

  it('registers only one hit per swing', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    approachPad(engine);
    tap(engine, 'light');
    const hits = engine.drainEvents().filter((event) => event.type === 'hit');
    expect(hits).toHaveLength(1);
  });

  it('cannot start a new attack until the previous one recovers', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    approachPad(engine);
    // Press strong, then immediately try to press light mid-action.
    engine.step(STEP, input({ strong: true }));
    engine.step(STEP, input({}));
    engine.step(STEP, input({ light: true }));
    run(engine, 0.02);
    expect(engine.getState().fighter.action).toBe('strong');
  });
});

describe('stamina', () => {
  it('spends stamina on attacks and dodges', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    const max = engine.getState().fighter.staminaMax;

    tap(engine, 'light', 0.02);
    expect(engine.getState().fighter.stamina).toBeCloseTo(max - STAMINA_COST.light, 1);
  });

  it('regenerates stamina after the recovery delay', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    tap(engine, 'strong', 0.05);
    const afterAttack = engine.getState().fighter.stamina;
    run(engine, 3);
    expect(engine.getState().fighter.stamina).toBeGreaterThan(afterAttack);
  });

  it('never exceeds the fighter’s maximum', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    run(engine, 10);
    const state = engine.getState();
    expect(state.fighter.stamina).toBeLessThanOrEqual(state.fighter.staminaMax);
  });

  it('refuses an action it cannot pay for and reports exhaustion', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    approachPad(engine);
    // Spend the bar down with repeated strong attacks.
    for (let i = 0; i < 12; i += 1) tap(engine, 'strong', 0.7);
    engine.drainEvents();

    // Drain whatever is left with a long guard, then try to attack.
    run(engine, 12, { block: true });
    engine.drainEvents();
    expect(engine.getStaminaRatio()).toBeLessThan(0.3);

    engine.step(STEP, input({ strong: true }));
    const events = typesOf(engine);
    expect(events).toContain('exhausted');
    expect(engine.getState().fighter.action).not.toBe('strong');
  });

  it('drains stamina while the guard is held', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    const before = engine.getState().fighter.stamina;
    run(engine, 1.5, { block: true });
    expect(engine.getState().fighter.stamina).toBeLessThan(before);
  });

  it('emits low then recovered as stamina cycles', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    run(engine, 14, { block: true });
    expect(typesOf(engine)).toContain('stamina-low');

    run(engine, 20);
    expect(typesOf(engine)).toContain('stamina-recovered');
    expect(engine.getStaminaRatio()).toBeGreaterThan(0.9);
  });
});

describe('block and dodge', () => {
  it('enters and leaves the guard with the block key', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    run(engine, 0.1, { block: true });
    expect(engine.getState().fighter.action).toBe('block');
    run(engine, 0.1);
    expect(engine.getState().fighter.action).toBe('idle');
  });

  it('grants evasion frames during a dodge', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    engine.step(STEP, input({ dodge: true }));
    expect(typesOf(engine)).toContain('dodge');
    run(engine, 0.12);
    expect(engine.getState().fighter.invulnerable).toBe(true);
    run(engine, 1);
    expect(engine.getState().fighter.invulnerable).toBe(false);
  });

  it('blocks an incoming practice strike when the guard is held', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    approachPad(engine);
    engine.setPadStriking(true);

    let blocked = false;
    for (let i = 0; i < 600 && !blocked; i += 1) {
      engine.step(STEP, input({ block: true }));
      blocked = engine.drainEvents().some((event) => event.type === 'block');
    }
    expect(blocked).toBe(true);
  });

  it('touches the fighter with a guard-reset stagger when undefended', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    approachPad(engine);
    engine.setPadStriking(true);

    let contacted = false;
    for (let i = 0; i < 600 && !contacted; i += 1) {
      engine.step(STEP, input({}));
      contacted = engine.drainEvents().some((event) => event.type === 'strike-contact');
    }
    expect(contacted).toBe(true);
    // Contact is a brief stagger only — no health and no injury state exists.
    expect(engine.getState().fighter.action).toBe('stagger');
  });

  it('stops throwing practice strikes when told to', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    approachPad(engine);
    engine.setPadStriking(true);
    run(engine, 0.5);
    engine.setPadStriking(false);
    engine.drainEvents();
    run(engine, 4);
    expect(typesOf(engine)).not.toContain('strike-telegraph');
  });
});

describe('combinations', () => {
  it('recognises light, light, strong landed inside the window', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    approachPad(engine);

    // Releases must exceed the light attack's recovery, or the second press is
    // correctly refused while the first technique is still running.
    tap(engine, 'light', 0.4);
    tap(engine, 'light', 0.4);
    engine.drainEvents();
    tap(engine, 'strong', 0.7);

    expect(typesOf(engine)).toContain('combo');
  });

  it('does not award a combination when the techniques are too far apart', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    approachPad(engine);

    tap(engine, 'light', 2);
    tap(engine, 'light', 2);
    engine.drainEvents();
    tap(engine, 'strong', 1);

    expect(typesOf(engine)).not.toContain('combo');
  });
});

describe('bow', () => {
  it('bows when standing still', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    engine.step(STEP, input({ bow: true }));
    expect(typesOf(engine)).toContain('bow');
    expect(engine.getState().fighter.action).toBe('bow');
  });

  it('does not bow while walking', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    run(engine, 0.2, { right: true });
    engine.drainEvents();
    engine.step(STEP, input({ right: true, bow: true }));
    expect(typesOf(engine)).not.toContain('bow');
  });
});

describe('frame-rate independence', () => {
  it('ignores a non-finite or negative elapsed time', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    const before = engine.getState().time;
    engine.advance(Number.NaN, NEUTRAL_INPUT);
    engine.advance(-1, NEUTRAL_INPUT);
    expect(engine.getState().time).toBe(before);
  });

  it('clamps an oversized frame instead of teleporting the fighter', () => {
    const engine = new CombatEngine(getFighter('andrew-gillian'));
    // A five-second frame, as if the tab had been backgrounded.
    engine.advance(5, input({ right: true }));
    // At most one clamped step of travel, nowhere near the far wall.
    expect(engine.getState().fighter.x).toBeLessThan(START_X + 60);
  });
});
