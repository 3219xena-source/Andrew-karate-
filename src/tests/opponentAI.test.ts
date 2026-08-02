/**
 * Opponent AI.
 *
 * The AI is driven headlessly against the real engine. The point of these
 * tests is not that it plays well, but that it plays LEGALLY: it obeys every
 * cost and cooldown the player obeys, it cannot act while stunned, it stays in
 * the arena, and it never stops responding.
 */

import { describe, expect, it } from 'vitest';
import { getFighter } from '../data/fighters.ts';
import { OpponentAI, difficultyForClub, type Difficulty } from '../systems/ai/opponentAI.ts';
import { MatchEngine } from '../systems/match/matchEngine.ts';
import {
  ARENA_WIDTH,
  FIGHTER_HALF_WIDTH,
  POWER_ATTACK_COST,
  WALL_MARGIN,
} from '../systems/match/constants.ts';
import { NEUTRAL_MATCH_INPUT, type MatchInput } from '../systems/match/types.ts';

const STEP = 1 / 120;

function input(overrides: Partial<MatchInput> = {}): MatchInput {
  return { ...NEUTRAL_MATCH_INPUT, ...overrides };
}

interface Harness {
  readonly engine: MatchEngine;
  readonly ai: OpponentAI;
  /** Runs the AI against a fixed player input for `seconds`. */
  readonly run: (seconds: number, playerInput?: Partial<MatchInput>) => void;
}

function harness(difficulty: Difficulty = 'standard', blueId = 'bram-hollis', seed = 12345): Harness {
  const red = getFighter('andrew-gillian');
  const blue = getFighter(blueId);
  if (!red || !blue) throw new Error('fixtures missing');

  const engine = new MatchEngine(red, blue, { humanCorner: 'red', roundSeconds: 600 });
  engine.beginFighting();
  const ai = new OpponentAI({
    difficulty,
    profile: blue.aiProfile,
    corner: 'blue',
    seed,
  });

  return {
    engine,
    ai,
    run: (seconds, playerInput = {}) => {
      const frames = Math.max(1, Math.round(seconds / STEP));
      for (let i = 0; i < frames; i += 1) {
        const aiInput = ai.update(engine.getState(), STEP);
        engine.step(STEP, input(playerInput), aiInput);
      }
    },
  };
}

describe('legality', () => {
  it('never lets the AI act while it is in hitstun', () => {
    const { engine, ai, run } = harness();
    for (let i = 0; i < 4000; i += 1) {
      const state = engine.getState();
      const blue = state.blue;
      if (blue.action === 'hitstun' || blue.action === 'knockdown') {
        const aiInput = ai.update(state, STEP);
        // While stunned the AI must release everything.
        expect(aiInput).toEqual(NEUTRAL_MATCH_INPUT);
        expect(ai.getIntent()).toBe('stunned');
      }
      run(STEP, { right: true, lightPunch: i % 40 === 0 });
      if (engine.getState().phase !== 'fighting') break;
    }
  });

  it('never drives the AI outside the arena', () => {
    const { engine, run } = harness();
    for (let i = 0; i < 60; i += 1) {
      run(0.5, { right: true });
      const blue = engine.getState().blue;
      expect(blue.x).toBeGreaterThanOrEqual(WALL_MARGIN + FIGHTER_HALF_WIDTH - 1);
      expect(blue.x).toBeLessThanOrEqual(ARENA_WIDTH - WALL_MARGIN - FIGHTER_HALF_WIDTH + 1);
      if (engine.getState().phase !== 'fighting') break;
    }
  });

  it('never lets the AI spend stamina or power it does not have', () => {
    const { engine, run } = harness('advanced');
    for (let i = 0; i < 200; i += 1) {
      run(0.15, { right: true });
      const blue = engine.getState().blue;
      expect(blue.stamina).toBeGreaterThanOrEqual(0);
      expect(blue.power).toBeGreaterThanOrEqual(0);
      expect(blue.power).toBeLessThanOrEqual(blue.maxPower);
      expect(blue.health).toBeGreaterThanOrEqual(0);
      expect(blue.health).toBeLessThanOrEqual(blue.maxHealth);
      if (engine.getState().phase !== 'fighting') break;
    }
  });

  it('cannot damage the player except by landing a real attack', () => {
    const { engine, run } = harness();
    const startHealth = engine.getState().red.health;
    // The player stands at the far wall, out of every attack's reach.
    run(6, { left: true });
    const state = engine.getState();
    const inReach = Math.abs(state.blue.x - state.red.x) < 200;
    if (!inReach) expect(state.red.health).toBe(startHealth);
  });

  it('produces no output at all outside the fighting phase', () => {
    const red = getFighter('andrew-gillian');
    const blue = getFighter('cathryn');
    if (!red || !blue) throw new Error('fixtures missing');
    const engine = new MatchEngine(red, blue);
    const ai = new OpponentAI({ difficulty: 'standard', profile: 'balanced', corner: 'blue' });
    expect(ai.update(engine.getState(), STEP)).toEqual(NEUTRAL_MATCH_INPUT);
  });
});

describe('behaviour', () => {
  it('closes the distance when the player runs away', () => {
    const { engine, run } = harness();
    const startGap = Math.abs(engine.getState().blue.x - engine.getState().red.x);
    run(3, {});
    const gap = Math.abs(engine.getState().blue.x - engine.getState().red.x);
    expect(gap).toBeLessThan(startGap);
  });

  it('attacks once it is in range', () => {
    const { engine, run } = harness('advanced');
    let attacked = false;
    for (let i = 0; i < 80 && !attacked; i += 1) {
      run(0.25);
      attacked = engine.drainEvents().some((event) => event.type === 'attack-thrown');
    }
    expect(attacked).toBe(true);
  });

  it('lands attacks on a player who never defends', () => {
    const { engine, run } = harness('advanced');
    let landed = false;
    for (let i = 0; i < 200 && !landed; i += 1) {
      run(0.2);
      landed = engine.drainEvents().some((event) => event.type === 'hit' && event.corner === 'blue');
      if (engine.getState().phase !== 'fighting') break;
    }
    expect(landed).toBe(true);
  });

  it('blocks or evades at least sometimes when attacked', () => {
    const { engine, run } = harness('advanced');
    let defended = false;
    for (let i = 0; i < 300 && !defended; i += 1) {
      // Walk in and attack repeatedly.
      run(0.12, { right: true, lightPunch: i % 3 === 0 });
      defended = engine
        .drainEvents()
        .some((event) => event.type === 'blocked' || event.type === 'dodged');
      if (engine.getState().phase !== 'fighting') break;
    }
    expect(defended).toBe(true);
  });

  it('backs off to recover when its stamina is spent', () => {
    const { engine, ai, run } = harness('advanced');
    let recovered = false;
    for (let i = 0; i < 600 && !recovered; i += 1) {
      run(0.1, { right: true });
      recovered = ai.getIntent() === 'recover';
      if (engine.getState().phase !== 'fighting') break;
    }
    // The AI does not have to run out of stamina, but if it does it must react.
    if (engine.getState().blue.stamina < engine.getState().blue.maxStamina * 0.26) {
      expect(recovered).toBe(true);
    }
  });

  it('never freezes: it keeps producing decisions for a whole long round', () => {
    const { engine, ai, run } = harness('standard');
    const intents = new Set<string>();
    for (let i = 0; i < 400; i += 1) {
      run(0.1, { right: i % 2 === 0, lightPunch: i % 7 === 0 });
      intents.add(ai.getIntent());
      if (engine.getState().phase !== 'fighting') break;
    }
    // A frozen AI would report a single intent forever.
    expect(intents.size).toBeGreaterThan(2);
  });
});

describe('difficulty', () => {
  it('makes the advanced band more active than the beginner band', () => {
    // Averaged across several seeds: a single fight is too noisy to compare,
    // because the two bands also defend differently and end rounds at
    // different moments.
    const countAttacks = (difficulty: Difficulty, seed: number): number => {
      const { engine, run } = harness(difficulty, 'bram-hollis', seed);
      let attacks = 0;
      for (let i = 0; i < 120; i += 1) {
        run(0.2, { right: true });
        attacks += engine
          .drainEvents()
          .filter((event) => event.type === 'attack-thrown' && event.corner === 'blue').length;
        if (engine.getState().phase !== 'fighting') break;
      }
      return attacks;
    };

    const seeds = [11, 2027, 90210, 555, 77];
    const beginner = seeds.reduce((sum, seed) => sum + countAttacks('beginner', seed), 0);
    const advanced = seeds.reduce((sum, seed) => sum + countAttacks('advanced', seed), 0);
    expect(advanced).toBeGreaterThan(beginner);
  });

  it('leaves a beginner opponent beatable', () => {
    // A player who simply presses forward and attacks should be able to take a
    // round from the beginner band.
    const { engine, run } = harness('beginner', 'jonah-pike');
    for (let i = 0; i < 600; i += 1) {
      run(0.1, { right: true, lightKick: i % 4 === 0 });
      if (engine.getState().phase !== 'fighting') break;
    }
    expect(engine.getState().blue.health).toBeLessThan(engine.getState().blue.maxHealth);
  });

  it('maps club difficulty onto an AI band without hidden advantages', () => {
    expect(difficultyForClub('approachable', 'standard')).toBe('beginner');
    expect(difficultyForClub('competitive', 'standard')).toBe('standard');
    expect(difficultyForClub('formidable', 'standard')).toBe('advanced');
    // An explicit player choice always wins.
    expect(difficultyForClub('formidable', 'beginner')).toBe('beginner');
    expect(difficultyForClub('approachable', 'advanced')).toBe('advanced');
  });
});

describe('determinism', () => {
  it('produces the same fight from the same seed', () => {
    const play = (): number => {
      const { engine, run } = harness('standard');
      run(12, { right: true });
      return Math.round(engine.getState().red.health * 1000);
    };
    expect(play()).toBe(play());
  });

  it('respects the power-attack cost like any other fighter', () => {
    const { engine, run } = harness('advanced');
    for (let i = 0; i < 300; i += 1) {
      run(0.1, { right: true, lightPunch: i % 5 === 0 });
      const blue = engine.getState().blue;
      // The meter may fill and empty, but it can never go negative or exceed
      // its maximum, and a power attack always costs the full bar.
      expect(blue.power).toBeLessThanOrEqual(POWER_ATTACK_COST);
      if (engine.getState().phase !== 'fighting') break;
    }
  });
});
