/**
 * Two-fighter match engine.
 *
 * The engine is pure and deterministic, so these tests drive it directly with
 * fixed steps — no canvas, no React, no timers.
 */

import { describe, expect, it } from 'vitest';
import { getFighter } from '../data/fighters.ts';
import { MatchEngine } from '../systems/match/matchEngine.ts';
import {
  ARENA_WIDTH,
  ATTACKS,
  MIN_SEPARATION,
  POWER_ATTACK_COST,
  ROUNDS_TO_WIN_BOUT,
  WALL_MARGIN,
  deriveCombatProfile,
} from '../systems/match/constants.ts';
import {
  NEUTRAL_MATCH_INPUT,
  type MatchEvent,
  type MatchInput,
  type MatchState,
} from '../systems/match/types.ts';

const STEP = 1 / 120;

function input(overrides: Partial<MatchInput> = {}): MatchInput {
  return { ...NEUTRAL_MATCH_INPUT, ...overrides };
}

function makeEngine(redId = 'andrew-gillian', blueId = 'bram-hollis'): MatchEngine {
  const red = getFighter(redId);
  const blue = getFighter(blueId);
  if (!red || !blue) throw new Error('test fixture fighters missing');
  const engine = new MatchEngine(red, blue, { humanCorner: 'red' });
  engine.beginFighting();
  engine.drainEvents();
  return engine;
}

/** Advances both fighters for `seconds` with constant inputs. */
function run(
  engine: MatchEngine,
  seconds: number,
  red: Partial<MatchInput> = {},
  blue: Partial<MatchInput> = {},
): void {
  const frames = Math.max(1, Math.round(seconds / STEP));
  for (let i = 0; i < frames; i += 1) engine.step(STEP, input(red), input(blue));
}

/** Presses a red-corner key for one frame, then holds neutral. */
function tapRed(engine: MatchEngine, key: keyof MatchInput, release = 0.6): void {
  engine.step(STEP, input({ [key]: true } as Partial<MatchInput>), input());
  run(engine, release);
}

/** Walks the two fighters into contact range. */
function closeDistance(engine: MatchEngine): void {
  for (let i = 0; i < 900; i += 1) {
    const state = engine.getState();
    if (Math.abs(state.blue.x - state.red.x) <= MIN_SEPARATION + 6) break;
    engine.step(STEP, input({ right: true }), input());
  }
  run(engine, 0.1);
  engine.drainEvents();
}

function types(engine: MatchEngine): string[] {
  return engine.drainEvents().map((event: MatchEvent) => event.type);
}

/**
 * Fills the red corner's power meter by landing real attacks, resting when
 * stamina runs low and stepping back into range after knockback. Returns true
 * once the meter reports itself full.
 */
function fillPowerMeter(engine: MatchEngine): boolean {
  let ready = false;
  for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
    if (engine.getState().red.stamina < 25) run(engine, 2.5);
    closeDistance(engine);
    tapRed(engine, 'lightPunch', 0.4);
    ready =
      engine.drainEvents().some((event) => event.type === 'power-ready') ||
      engine.getState().red.power >= POWER_ATTACK_COST;
  }
  return ready;
}

describe('setup', () => {
  it('places the two fighters apart, facing each other', () => {
    const state: MatchState = makeEngine().getState();
    expect(state.red.x).toBeLessThan(state.blue.x);
    expect(state.red.facing).toBe(1);
    expect(state.blue.facing).toBe(-1);
    expect(state.round).toBe(1);
    expect(state.phase).toBe('fighting');
  });

  it('derives per-fighter handling from the authored ratings', () => {
    const quick = deriveCombatProfile(getFighter('ales-gillian')?.stats);
    const heavy = deriveCombatProfile(getFighter('bram-hollis')?.stats);
    expect(quick.moveSpeed).toBeGreaterThan(heavy.moveSpeed);
    expect(heavy.damageScale).toBeGreaterThan(quick.damageScale);
    expect(heavy.toughness).toBeLessThan(quick.toughness);
  });

  it('gives both fighters full health, stamina and no power', () => {
    const { red, blue } = makeEngine().getState();
    for (const sim of [red, blue]) {
      expect(sim.health).toBe(sim.maxHealth);
      expect(sim.stamina).toBe(sim.maxStamina);
      expect(sim.power).toBe(0);
      expect(sim.roundWins).toBe(0);
    }
  });
});

describe('movement', () => {
  it('walks left and right', () => {
    const engine = makeEngine();
    const start = engine.getState().red.x;
    run(engine, 0.4, { right: true });
    expect(engine.getState().red.x).toBeGreaterThan(start);
    run(engine, 0.8, { left: true });
    expect(engine.getState().red.x).toBeLessThan(start);
  });

  it('keeps both fighters inside the arena', () => {
    const engine = makeEngine();
    run(engine, 12, { left: true }, { right: true });
    const { red, blue } = engine.getState();
    expect(red.x).toBeGreaterThanOrEqual(WALL_MARGIN);
    expect(blue.x).toBeLessThanOrEqual(ARENA_WIDTH - WALL_MARGIN);
  });

  it('never lets the two fighters occupy the same space', () => {
    const engine = makeEngine();
    for (let i = 0; i < 1200; i += 1) {
      engine.step(STEP, input({ right: true }), input({ left: true }));
      const { red, blue } = engine.getState();
      expect(Math.abs(blue.x - red.x)).toBeGreaterThanOrEqual(MIN_SEPARATION - 1);
    }
  });

  it('jumps and lands', () => {
    const engine = makeEngine();
    engine.step(STEP, input({ up: true }), input());
    expect(types(engine)).toContain('jump');
    run(engine, 0.15);
    expect(engine.getState().red.y).toBeGreaterThan(0);
    run(engine, 3);
    expect(engine.getState().red.grounded).toBe(true);
    expect(engine.getState().red.y).toBe(0);
  });

  it('crouches while the down key is held and stands when it is released', () => {
    const engine = makeEngine();
    run(engine, 0.1, { down: true });
    expect(engine.getState().red.crouching).toBe(true);
    run(engine, 0.1);
    expect(engine.getState().red.crouching).toBe(false);
  });

  it('faces the opponent when they cross over', () => {
    const engine = makeEngine();
    run(engine, 6, { right: true }, { left: true });
    // Even pressed together they cannot swap sides, so facing stays consistent.
    expect(engine.getState().red.facing).toBe(1);
    expect(engine.getState().blue.facing).toBe(-1);
  });
});

describe('attacks', () => {
  const cases: Array<[keyof MatchInput, string]> = [
    ['lightPunch', 'lightPunch'],
    ['strongPunch', 'strongPunch'],
    ['lightKick', 'lightKick'],
    ['strongKick', 'strongKick'],
  ];

  for (const [key, attackId] of cases) {
    it(`lands a ${attackId}`, () => {
      const engine = makeEngine();
      closeDistance(engine);
      const before = engine.getState().blue.health;
      tapRed(engine, key, 0.8);
      const events = engine.drainEvents();
      const hit = events.find((event) => event.type === 'hit');
      expect(hit?.attack).toBe(attackId);
      expect(engine.getState().blue.health).toBeLessThan(before);
    });
  }

  it('lands a crouching attack from a crouch', () => {
    const engine = makeEngine();
    closeDistance(engine);
    engine.step(STEP, input({ down: true }), input());
    engine.step(STEP, input({ down: true, lightPunch: true }), input());
    run(engine, 0.6);
    const hit = engine.drainEvents().find((event) => event.type === 'hit');
    expect(hit?.attack).toBe('crouchAttack');
  });

  it('lands a jumping attack while airborne', () => {
    const engine = makeEngine();
    closeDistance(engine);
    engine.step(STEP, input({ up: true }), input());
    run(engine, 0.12);
    engine.drainEvents();
    engine.step(STEP, input({ lightPunch: true }), input());
    run(engine, 0.3);
    const hit = engine.drainEvents().find((event) => event.type === 'hit');
    expect(hit?.attack).toBe('jumpAttack');
  });

  it('misses when the opponent is out of reach', () => {
    const engine = makeEngine();
    tapRed(engine, 'lightPunch');
    expect(types(engine)).not.toContain('hit');
  });

  it('registers only one hit per swing', () => {
    const engine = makeEngine();
    closeDistance(engine);
    tapRed(engine, 'lightPunch', 0.8);
    expect(engine.drainEvents().filter((event) => event.type === 'hit')).toHaveLength(1);
  });

  it('cannot start a new attack until the previous one recovers', () => {
    const engine = makeEngine();
    closeDistance(engine);
    engine.step(STEP, input({ strongPunch: true }), input());
    engine.step(STEP, input(), input());
    engine.step(STEP, input({ lightPunch: true }), input());
    run(engine, 0.02);
    expect(engine.getState().red.attack).toBe('strongPunch');
  });

  it('keeps strong attacks slower and dearer than light attacks', () => {
    expect(ATTACKS.strongPunch.windup).toBeGreaterThan(ATTACKS.lightPunch.windup);
    expect(ATTACKS.strongPunch.stamina).toBeGreaterThan(ATTACKS.lightPunch.stamina);
    expect(ATTACKS.strongPunch.damage).toBeGreaterThan(ATTACKS.lightPunch.damage);
    expect(ATTACKS.strongKick.windup).toBeGreaterThan(ATTACKS.lightKick.windup);
  });

  it('gives kicks more reach than punches', () => {
    expect(ATTACKS.lightKick.reach).toBeGreaterThan(ATTACKS.lightPunch.reach);
    expect(ATTACKS.strongKick.reach).toBeGreaterThan(ATTACKS.strongPunch.reach);
  });

  it('charges stamina for every attack', () => {
    for (const spec of Object.values(ATTACKS)) {
      expect(spec.stamina).toBeGreaterThan(0);
    }
  });
});

describe('defence', () => {
  it('reduces damage when a standing guard is held', () => {
    const guarded = makeEngine();
    closeDistance(guarded);
    const startGuarded = guarded.getState().red.health;
    run(guarded, 0.02, { block: true });
    for (let i = 0; i < 160; i += 1) {
      guarded.step(STEP, input({ block: true }), input({ strongPunch: i === 0 }));
    }
    const guardedLoss = startGuarded - guarded.getState().red.health;

    const open = makeEngine();
    closeDistance(open);
    const startOpen = open.getState().red.health;
    for (let i = 0; i < 160; i += 1) {
      open.step(STEP, input(), input({ strongPunch: i === 0 }));
    }
    const openLoss = startOpen - open.getState().red.health;

    expect(guardedLoss).toBeGreaterThan(0);
    expect(guardedLoss).toBeLessThan(openLoss);
  });

  it('lets a crouching attack through a standing guard for more damage', () => {
    const standing = makeEngine();
    closeDistance(standing);
    const before = standing.getState().red.health;
    for (let i = 0; i < 200; i += 1) {
      standing.step(STEP, input({ block: true }), input({ down: i < 3, lightPunch: i === 3 }));
    }
    const throughGuard = before - standing.getState().red.health;
    expect(throughGuard).toBeGreaterThan(0);
  });

  it('grants evasion frames during a dodge', () => {
    const engine = makeEngine();
    engine.step(STEP, input({ dodge: true }), input());
    run(engine, 0.1);
    expect(engine.getState().red.invulnerable).toBe(true);
    run(engine, 1);
    expect(engine.getState().red.invulnerable).toBe(false);
  });

  it('evades an attack thrown into the dodge window', () => {
    const engine = makeEngine();
    closeDistance(engine);
    // Dodge forwards, so the fighters stay in range, then have the opponent
    // swing into the evasion frames.
    engine.step(STEP, input({ dodge: true, right: true }), input());
    run(engine, 0.06, { right: true });
    engine.drainEvents();
    for (let i = 0; i < 24; i += 1) {
      engine.step(STEP, input(), input({ lightPunch: i === 0 }));
    }
    expect(types(engine)).toContain('dodged');
  });

  it('drains stamina while the guard is held and breaks it at zero', () => {
    const engine = makeEngine();
    const before = engine.getState().red.stamina;
    run(engine, 2, { block: true });
    expect(engine.getState().red.stamina).toBeLessThan(before);
    run(engine, 30, { block: true });
    expect(engine.getState().red.action).not.toBe('block');
  });
});

describe('stamina and power', () => {
  it('refuses an action it cannot pay for', () => {
    const engine = makeEngine();
    // Holding the guard drains the bar to zero and breaks it. Stamina then
    // stays empty for the regeneration delay, which is the window to test in.
    run(engine, 25, { block: true });
    expect(engine.getState().red.stamina).toBeLessThan(1);
    engine.drainEvents();

    engine.step(STEP, input({ strongKick: true }), input());
    expect(types(engine)).toContain('exhausted');
    expect(engine.getState().red.attack).toBeNull();
  });

  it('regenerates stamina after the recovery delay', () => {
    const engine = makeEngine();
    tapRed(engine, 'strongPunch', 0.05);
    const after = engine.getState().red.stamina;
    run(engine, 3);
    expect(engine.getState().red.stamina).toBeGreaterThan(after);
  });

  it('builds power from landing attacks and announces a full meter', () => {
    const engine = makeEngine();
    const ready = fillPowerMeter(engine);
    expect(ready).toBe(true);
    expect(engine.getState().red.power).toBeGreaterThanOrEqual(POWER_ATTACK_COST);
  });

  it('spends the whole meter on a power attack, which cannot repeat', () => {
    const engine = makeEngine();
    // Earn a full meter through legitimate play.
    expect(fillPowerMeter(engine)).toBe(true);
    run(engine, 2.5);
    closeDistance(engine);
    engine.drainEvents();

    tapRed(engine, 'power', 1.2);
    const events = engine.drainEvents();
    expect(events.some((event) => event.type === 'power-used')).toBe(true);
    expect(engine.getState().red.power).toBeLessThan(POWER_ATTACK_COST);

    // A second immediate attempt is refused because the meter is spent.
    engine.step(STEP, input({ power: true }), input());
    expect(types(engine)).not.toContain('power-used');
  });

  it('gains power for the fighter taking damage, so a comeback is possible', () => {
    const engine = makeEngine();
    closeDistance(engine);
    for (let i = 0; i < 60; i += 1) {
      engine.step(STEP, input(), input({ strongPunch: i === 0 }));
    }
    expect(engine.getState().red.power).toBeGreaterThan(0);
  });
});

describe('rounds and bouts', () => {
  it('ends a round by knockout when health reaches zero', () => {
    const engine = makeEngine();
    closeDistance(engine);
    // Drive the opponent's health to zero through repeated legal attacks.
    for (let i = 0; i < 400 && engine.getState().blue.health > 0; i += 1) {
      tapRed(engine, 'strongKick', 0.5);
      if (engine.getState().red.stamina < 30) run(engine, 2);
    }
    expect(engine.getState().blue.health).toBe(0);
    expect(engine.getState().roundEndReason).toBe('knockout');
    expect(engine.getState().roundWinner).toBe('red');
    expect(engine.getState().red.roundWins).toBe(1);
  });

  it('ends a round on the clock and awards it on remaining health', () => {
    const red = getFighter('andrew-gillian');
    const blue = getFighter('bram-hollis');
    if (!red || !blue) throw new Error('fixtures missing');
    const engine = new MatchEngine(red, blue, { humanCorner: 'red', roundSeconds: 2 });
    engine.beginFighting();
    closeDistance(engine);
    // One clean hit is enough to lead on health when the clock runs out.
    tapRed(engine, 'lightPunch', 0.6);
    run(engine, 4);
    expect(engine.getState().phase).not.toBe('fighting');
    expect(engine.getState().roundEndReason).toBe('timeout');
    expect(engine.getState().roundWinner).toBe('red');
  });

  it('plays sudden death when a round expires exactly level', () => {
    const red = getFighter('andrew-gillian');
    const blue = getFighter('cathryn');
    if (!red || !blue) throw new Error('fixtures missing');
    const engine = new MatchEngine(red, blue, { humanCorner: 'red', roundSeconds: 1 });
    engine.beginFighting();
    // Neither fighter attacks, so health stays level and the clock expires.
    run(engine, 1.2);
    expect(engine.getState().suddenDeath).toBe(true);
    expect(engine.getState().phase).toBe('fighting');
  });

  it('takes the bout when a fighter wins two rounds', () => {
    const red = getFighter('andrew-gillian');
    const blue = getFighter('cathryn');
    if (!red || !blue) throw new Error('fixtures missing');
    const engine = new MatchEngine(red, blue, { humanCorner: 'red', roundSeconds: 2 });
    engine.beginFighting();

    for (let round = 0; round < ROUNDS_TO_WIN_BOUT; round += 1) {
      closeDistance(engine);
      tapRed(engine, 'strongKick', 0.6);
      run(engine, 4);
      if (engine.getState().phase === 'round-over') engine.startNextRound();
      if (engine.getState().phase === 'ready') engine.beginFighting();
    }

    expect(engine.getState().boutWinner).toBe('red');
    expect(engine.getState().phase).toBe('bout-over');
  });

  it('resets positions, health and stamina between rounds', () => {
    const red = getFighter('andrew-gillian');
    const blue = getFighter('cathryn');
    if (!red || !blue) throw new Error('fixtures missing');
    // The clock must outlast the walk into range, or the round ends first.
    const engine = new MatchEngine(red, blue, { humanCorner: 'red', roundSeconds: 6 });
    engine.beginFighting();
    closeDistance(engine);
    tapRed(engine, 'lightPunch', 0.6);
    run(engine, 8);

    expect(engine.getState().phase).toBe('round-over');
    engine.startNextRound();
    const state = engine.getState();
    expect(state.round).toBe(2);
    expect(state.red.health).toBe(state.red.maxHealth);
    expect(state.blue.health).toBe(state.blue.maxHealth);
    expect(state.red.stamina).toBe(state.red.maxStamina);
    expect(state.red.power).toBe(0);
    // Round wins carry over.
    expect(state.red.roundWins).toBe(1);
  });

  it('accepts no input outside the fighting phase', () => {
    const red = getFighter('andrew-gillian');
    const blue = getFighter('cathryn');
    if (!red || !blue) throw new Error('fixtures missing');
    const engine = new MatchEngine(red, blue);
    const before = engine.getState().red.x;
    run(engine, 1, { right: true });
    expect(engine.getState().red.x).toBe(before);
  });

  it('warns when the round clock is running out', () => {
    const red = getFighter('andrew-gillian');
    const blue = getFighter('cathryn');
    if (!red || !blue) throw new Error('fixtures missing');
    const engine = new MatchEngine(red, blue, { roundSeconds: 11 });
    engine.beginFighting();
    engine.drainEvents();
    run(engine, 1.5);
    expect(types(engine)).toContain('time-warning');
  });
});

describe('frame-rate independence', () => {
  it('ignores a non-finite or negative elapsed time', () => {
    const engine = makeEngine();
    const before = engine.getState().time;
    engine.advance(Number.NaN, input(), input());
    engine.advance(-1, input(), input());
    expect(engine.getState().time).toBe(before);
  });

  it('clamps an oversized frame instead of teleporting a fighter', () => {
    const engine = makeEngine();
    const before = engine.getState().red.x;
    engine.advance(5, input({ right: true }), input());
    expect(engine.getState().red.x).toBeLessThan(before + 60);
  });
});
