/**
 * Tutorial engine.
 *
 * Drives a list of `ObjectiveDefinition`s in order against a live
 * `CombatEngine`. Objectives are activated one at a time so the coach always
 * has a single clear instruction to give, which also keeps the practice pad
 * quiet except during the guard and evasion drills.
 *
 * The engine is deliberately resumable: construct it with the objective ids the
 * player has already completed, and it will skip straight to the first
 * outstanding one.
 */

import type { CombatEngine } from '../combat/combatEngine.ts';
import type { CombatEvent } from '../combat/types.ts';
import type {
  ObjectiveContext,
  ObjectiveDefinition,
  ObjectiveProgress,
  TutorialStatus,
} from './types.ts';

export interface TutorialUpdate {
  /** Objectives completed during this update, in completion order. */
  readonly completed: readonly ObjectiveDefinition[];
  /** True when the final objective completed during this update. */
  readonly finished: boolean;
}

const EMPTY_UPDATE: TutorialUpdate = { completed: [], finished: false };

export class TutorialEngine {
  private readonly definitions: readonly ObjectiveDefinition[];
  private readonly engine: CombatEngine;
  private readonly progress = new Map<string, number>();
  private readonly completedIds: string[] = [];
  private memory: Record<string, number> = {};
  private activeIndex = 0;
  private activated = false;

  constructor(
    engine: CombatEngine,
    definitions: readonly ObjectiveDefinition[],
    completedIds: readonly string[] = [],
  ) {
    this.engine = engine;
    this.definitions = definitions;

    // Restore prior completions, ignoring any id that is no longer in the
    // curriculum so an old save cannot wedge the tutorial.
    const known = new Set(definitions.map((definition) => definition.id));
    for (const id of completedIds) {
      if (!known.has(id) || this.completedIds.includes(id)) continue;
      this.completedIds.push(id);
      const definition = definitions.find((candidate) => candidate.id === id);
      if (definition) this.progress.set(id, definition.target);
    }
    this.activeIndex = definitions.findIndex((definition) => !this.progress.has(definition.id));
    if (this.activeIndex === -1) this.activeIndex = definitions.length;
  }

  get status(): TutorialStatus {
    return this.activeIndex >= this.definitions.length ? 'complete' : 'active';
  }

  /** The objective the player is currently working on, if any. */
  getActiveObjective(): ObjectiveDefinition | null {
    return this.definitions[this.activeIndex] ?? null;
  }

  getCompletedIds(): readonly string[] {
    return this.completedIds;
  }

  /** Progress for every objective, in curriculum order. */
  getProgress(): readonly ObjectiveProgress[] {
    return this.definitions.map((definition) => {
      const current = this.progress.get(definition.id) ?? 0;
      return {
        id: definition.id,
        current: Math.min(current, definition.target),
        target: definition.target,
        complete: current >= definition.target,
      };
    });
  }

  /**
   * Feeds one update to the active objective. Call once per rendered frame,
   * after `CombatEngine.drainEvents()`.
   */
  update(events: readonly CombatEvent[]): TutorialUpdate {
    if (this.status === 'complete') return EMPTY_UPDATE;

    this.ensureActivated();

    const completed: ObjectiveDefinition[] = [];
    const definition = this.definitions[this.activeIndex];
    if (!definition) return EMPTY_UPDATE;

    const context: ObjectiveContext = { events, engine: this.engine, memory: this.memory };
    let value = 0;
    try {
      value = definition.measure(context);
    } catch (error) {
      // A broken objective must not take the dojo down with it. Surface it and
      // leave the objective un-advanced so the player can still reset or leave.
      console.error(`[tutorial] objective "${definition.id}" failed to measure`, error);
      return EMPTY_UPDATE;
    }

    this.progress.set(definition.id, value);

    if (value >= definition.target) {
      this.completedIds.push(definition.id);
      completed.push(definition);
      this.activeIndex += 1;
      this.activated = false;
      this.memory = {};
      this.applyPadPolicy();
    }

    const finished = completed.length > 0 && this.activeIndex >= this.definitions.length;
    return { completed, finished };
  }

  /**
   * Applies the current objective's pad policy. Called on construction by the
   * dojo so the pad state matches a resumed objective.
   */
  applyPadPolicy(): void {
    const definition = this.getActiveObjective();
    this.engine.setPadStriking(definition?.padStrikes === true);
  }

  /** Clears all progress and returns to the first objective. */
  reset(): void {
    this.progress.clear();
    this.completedIds.length = 0;
    this.memory = {};
    this.activeIndex = 0;
    this.activated = false;
    this.applyPadPolicy();
  }

  private ensureActivated(): void {
    if (this.activated) return;
    this.activated = true;
    const definition = this.definitions[this.activeIndex];
    if (!definition) return;
    this.memory = {};
    this.applyPadPolicy();
    try {
      definition.onActivate?.({ events: [], engine: this.engine, memory: this.memory });
    } catch (error) {
      console.error(`[tutorial] objective "${definition.id}" failed to activate`, error);
    }
  }
}
