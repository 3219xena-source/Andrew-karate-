/**
 * Save-schema migrations.
 *
 * Each entry upgrades a save from version N to N+1. `migrateSave` applies them
 * in sequence, so a version-1 save can reach the current version through any
 * number of intermediate steps.
 *
 * There are no migrations yet — version 1 is the first published schema. The
 * machinery exists now so that the first schema change is a data change rather
 * than an architectural one.
 */

import { SAVE_VERSION } from '../../types/save.ts';

export type Migration = (input: Record<string, unknown>) => Record<string, unknown>;

/** Keyed by the version being migrated FROM. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // Example of the intended shape, for whoever adds version 2:
  //
  // 1: (input) => ({ ...input, version: 2, roster: { unlocked: [] } }),
};

/**
 * Applies every migration from `fromVersion` up to the current version. A
 * missing migration stops the chain and returns what has been achieved so far;
 * the caller then sanitises the result, so the worst case is lost progress
 * rather than a crash.
 */
export function migrateSave(
  input: Record<string, unknown>,
  fromVersion: number,
): Record<string, unknown> {
  let data = input;
  let version = fromVersion;

  while (version < SAVE_VERSION) {
    const migration = MIGRATIONS[version];
    if (!migration) {
      console.warn(`[save] no migration registered from version ${version}; keeping what is readable`);
      break;
    }
    data = migration(data);
    version += 1;
  }

  return { ...data, version: SAVE_VERSION };
}
