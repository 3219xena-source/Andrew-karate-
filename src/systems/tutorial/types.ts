/**
 * Tutorial engine types.
 *
 * Objectives are declarative records in `src/data/tutorial.ts`. The engine has
 * no knowledge of any particular objective: it activates them in order, feeds
 * each one the combat event stream, and records completion.
 */

import type { CombatEngine } from '../combat/combatEngine.ts';
import type { CombatEvent } from '../combat/types.ts';

export interface ObjectiveContext {
  /** Combat events produced since the previous tutorial update. */
  readonly events: readonly CombatEvent[];
  /** The live engine, for objectives that test position or stamina. */
  readonly engine: CombatEngine;
  /** Per-objective scratch space, cleared when the objective activates. */
  readonly memory: Record<string, number>;
}

export interface ObjectiveDefinition {
  readonly id: string;
  /** Short label for the objective list. */
  readonly title: string;
  /** Imperative instruction shown to the player. */
  readonly instruction: string;
  /** Coach dialogue shown while this objective is active. */
  readonly coachLine: string;
  /** Coach dialogue shown briefly on completion. */
  readonly successLine: string;
  /** Units of progress needed to complete the objective. */
  readonly target: number;
  /** Optional unit noun for the progress readout, e.g. "strikes blocked". */
  readonly progressNoun?: string;
  /** When true, the practice pad throws strikes while this objective is active. */
  readonly padStrikes?: boolean;
  /** Called once when the objective becomes active. */
  readonly onActivate?: (context: ObjectiveContext) => void;
  /**
   * Returns this objective's progress, expressed as an absolute value between
   * 0 and `target`. Called once per tutorial update while active.
   */
  readonly measure: (context: ObjectiveContext) => number;
}

export interface ObjectiveProgress {
  readonly id: string;
  readonly current: number;
  readonly target: number;
  readonly complete: boolean;
}

export type TutorialStatus = 'active' | 'complete';
