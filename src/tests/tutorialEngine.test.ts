/**
 * Tutorial engine and the Stage 1 curriculum.
 *
 * These tests drive the real curriculum against the real combat engine, so a
 * pass means the ten objectives are genuinely completable through gameplay
 * inputs — not that a counter was incremented directly.
 */

import { describe, expect, it } from 'vitest';
import { getFighter } from '../data/fighters.ts';
import { TUTORIAL_OBJECTIVES } from '../data/tutorial.ts';
import { CombatEngine } from '../systems/combat/combatEngine.ts';
import { PAD_X } from '../systems/combat/constants.ts';
import { NEUTRAL_INPUT, type InputState } from '../systems/combat/types.ts';
import { TutorialEngine } from '../systems/tutorial/tutorialEngine.ts';

const STEP = 1 / 120;

function input(overrides: Partial<InputState> = {}): InputState {
  return { ...NEUTRAL_INPUT, ...overrides };
}

interface Harness {
  readonly engine: CombatEngine;
  readonly tutorial: TutorialEngine;
  /** Advances both engines for `seconds` with a constant input. */
  readonly hold: (seconds: number, held?: Partial<InputState>) => void;
  /** Presses a key for one frame, then holds neutral for `release` seconds. */
  readonly tap: (key: keyof InputState, release?: number) => void;
}

function createHarness(completed: readonly string[] = []): Harness {
  const engine = new CombatEngine(getFighter('andrew-gillian'));
  const tutorial = new TutorialEngine(engine, TUTORIAL_OBJECTIVES, completed);
  tutorial.applyPadPolicy();

  const advance = (seconds: number, held: Partial<InputState>) => {
    const frames = Math.max(1, Math.round(seconds / STEP));
    for (let i = 0; i < frames; i += 1) {
      engine.step(STEP, input(held));
      tutorial.update(engine.drainEvents());
    }
  };

  return {
    engine,
    tutorial,
    hold: (seconds, held = {}) => advance(seconds, held),
    tap: (key, release = 0.45) => {
      advance(STEP, { [key]: true } as Partial<InputState>);
      advance(release, {});
    },
  };
}

/** Runs the whole curriculum with gameplay inputs. Returns the harness. */
function completeCurriculum(): Harness {
  const harness = createHarness();
  const { engine, tutorial, hold, tap } = harness;

  // 1. Reach the mark.
  hold(1.2, { right: true });
  expect(tutorial.getActiveObjective()?.id).toBe('footwork');

  // 2. Footwork: travel both ways.
  hold(0.6, { left: true });
  hold(0.8, { right: true });
  expect(tutorial.getActiveObjective()?.id).toBe('jump');

  // 3. Jump.
  tap('jump', 1.2);
  expect(tutorial.getActiveObjective()?.id).toBe('light-attacks');

  // 4. Three light attacks on the pad.
  while (engine.getState().fighter.x < PAD_X - 80) hold(STEP, { right: true });
  hold(0.1);
  for (let i = 0; i < 3; i += 1) tap('light', 0.45);
  expect(tutorial.getActiveObjective()?.id).toBe('strong-attack');

  // 5. One strong attack.
  tap('strong', 0.9);
  expect(tutorial.getActiveObjective()?.id).toBe('block');

  // 6. Block two practice strikes.
  for (let i = 0; i < 900 && tutorial.getActiveObjective()?.id === 'block'; i += 1) {
    hold(STEP, { block: true });
    // Release the guard periodically so stamina recovers enough to keep it up.
    if (i % 240 === 239) hold(0.6);
  }
  expect(tutorial.getActiveObjective()?.id).toBe('dodge');

  // 7. Dodge an incoming strike: react to the telegraph.
  for (let i = 0; i < 3000 && tutorial.getActiveObjective()?.id === 'dodge'; i += 1) {
    const pad = engine.getState().pad;
    const dodging = pad.phase === 'telegraph' && pad.phaseTime > 0.5;
    hold(STEP, dodging ? { dodge: true } : {});
  }
  expect(tutorial.getActiveObjective()?.id).toBe('combination');

  // 8. Light, light, strong. The dodge drill pushes the fighter off the pad,
  // so step back into range and let stamina recover first.
  hold(6);
  while (engine.getState().fighter.x < PAD_X - 80) hold(STEP, { right: true });
  hold(2.5);
  tap('light', 0.4);
  tap('light', 0.4);
  tap('strong', 0.9);
  expect(tutorial.getActiveObjective()?.id).toBe('stamina');

  // 9. Run stamina down, then rest until it recovers.
  hold(16, { block: true });
  hold(24);
  expect(tutorial.getActiveObjective()?.id).toBe('bow');

  // 10. Bow.
  tap('bow', 1.2);

  return harness;
}

describe('tutorial engine', () => {
  it('starts on the first objective with nothing complete', () => {
    const { tutorial } = createHarness();
    expect(tutorial.status).toBe('active');
    expect(tutorial.getActiveObjective()?.id).toBe(TUTORIAL_OBJECTIVES[0]?.id);
    expect(tutorial.getCompletedIds()).toEqual([]);
    expect(tutorial.getProgress().every((entry) => !entry.complete)).toBe(true);
  });

  it('exposes ten objectives, each with instruction and coach text', () => {
    expect(TUTORIAL_OBJECTIVES).toHaveLength(10);
    for (const objective of TUTORIAL_OBJECTIVES) {
      expect(objective.instruction.length).toBeGreaterThan(10);
      expect(objective.coachLine.length).toBeGreaterThan(10);
      expect(objective.successLine.length).toBeGreaterThan(5);
      expect(objective.target).toBeGreaterThan(0);
    }
    expect(new Set(TUTORIAL_OBJECTIVES.map((o) => o.id)).size).toBe(10);
  });

  it('only runs the practice pad during the guard and evasion drills', () => {
    const padObjectives = TUTORIAL_OBJECTIVES.filter((objective) => objective.padStrikes === true);
    expect(padObjectives.map((objective) => objective.id)).toEqual(['block', 'dodge']);
  });

  it('advances objective by objective in curriculum order', () => {
    const { tutorial, hold } = createHarness();
    expect(tutorial.getActiveObjective()?.id).toBe('reach-mark');
    hold(1.2, { right: true });
    expect(tutorial.getActiveObjective()?.id).toBe('footwork');
    expect(tutorial.getCompletedIds()).toEqual(['reach-mark']);
    expect(tutorial.getProgress()[0]?.complete).toBe(true);
  });

  it('reports partial progress towards a multi-step objective', () => {
    const { tutorial, hold } = createHarness(['reach-mark']);
    expect(tutorial.getActiveObjective()?.id).toBe('footwork');
    hold(0.6, { left: true });
    const footwork = tutorial.getProgress().find((entry) => entry.id === 'footwork');
    expect(footwork?.current).toBe(1);
    expect(footwork?.target).toBe(2);
    expect(footwork?.complete).toBe(false);
  });

  it('resumes at the first outstanding objective from saved progress', () => {
    const { tutorial } = createHarness(['reach-mark', 'footwork', 'jump']);
    expect(tutorial.getActiveObjective()?.id).toBe('light-attacks');
    expect(tutorial.getCompletedIds()).toEqual(['reach-mark', 'footwork', 'jump']);
  });

  it('ignores objective ids from an old save that no longer exist', () => {
    const { tutorial } = createHarness(['reach-mark', 'removed-objective', 'reach-mark']);
    expect(tutorial.getCompletedIds()).toEqual(['reach-mark']);
    expect(tutorial.getActiveObjective()?.id).toBe('footwork');
  });

  it('reports complete when every objective is already saved', () => {
    const ids = TUTORIAL_OBJECTIVES.map((objective) => objective.id);
    const { tutorial } = createHarness(ids);
    expect(tutorial.status).toBe('complete');
    expect(tutorial.getActiveObjective()).toBeNull();
    expect(tutorial.update([])).toEqual({ completed: [], finished: false });
  });

  it('returns to the first objective after a reset', () => {
    const { tutorial, hold } = createHarness();
    hold(1.2, { right: true });
    expect(tutorial.getCompletedIds()).toHaveLength(1);
    tutorial.reset();
    expect(tutorial.getCompletedIds()).toEqual([]);
    expect(tutorial.getActiveObjective()?.id).toBe('reach-mark');
    expect(tutorial.status).toBe('active');
  });

  it('turns the practice pad on for the guard drill and off again afterwards', () => {
    const ids = ['reach-mark', 'footwork', 'jump', 'light-attacks', 'strong-attack'];
    const { engine, tutorial } = createHarness(ids);
    expect(tutorial.getActiveObjective()?.id).toBe('block');
    tutorial.update([]);
    expect(engine.getState().pad.striking).toBe(true);
  });
});

describe('full curriculum', () => {
  it('can be completed end to end with gameplay inputs', () => {
    const { tutorial } = completeCurriculum();

    expect(tutorial.status).toBe('complete');
    expect(tutorial.getCompletedIds()).toEqual(TUTORIAL_OBJECTIVES.map((objective) => objective.id));
    expect(tutorial.getProgress().every((entry) => entry.complete)).toBe(true);
    expect(tutorial.getActiveObjective()).toBeNull();
  });

  it('stops the practice pad once the session is complete', () => {
    const { engine } = completeCurriculum();
    expect(engine.getState().pad.striking).toBe(false);
  });
});
