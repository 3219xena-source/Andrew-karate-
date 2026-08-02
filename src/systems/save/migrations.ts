/**
 * Save-schema migrations.
 *
 * Each entry upgrades a save from version N to N+1. `migrateSave` applies them
 * in sequence, so a version-1 save can reach the current version through any
 * number of intermediate steps.
 *
 * See `docs/SAVE_MIGRATION.md` for the field-by-field mapping.
 */

import { SAVE_VERSION } from '../../types/save.ts';

/**
 * Fighter ids that were retired in version 3, and what replaces them.
 *
 * Cathryn was removed from the Hobart roster and her junior slot is now filled
 * by Bea Halloran. Remapping rather than deleting means a save's completed
 * bouts keep their scores and a season's results stay intact — the bout is
 * still recorded, just attributed to the fighter who now holds that slot.
 */
export const RETIRED_FIGHTER_IDS: Readonly<Record<string, string>> = {
  cathryn: 'bea-halloran',
};

/** Rewrites every retired fighter id anywhere in a save payload. */
function remapRetiredFighters(value: unknown): unknown {
  if (typeof value === 'string') return RETIRED_FIGHTER_IDS[value] ?? value;
  if (Array.isArray(value)) return value.map(remapRetiredFighters);
  if (typeof value === 'object' && value !== null) {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      // Career records are keyed BY fighter id, so the key is remapped too.
      output[RETIRED_FIGHTER_IDS[key] ?? key] = remapRetiredFighters(entry);
    }
    return output;
  }
  return value;
}

export type Migration = (input: Record<string, unknown>) => Record<string, unknown>;

/** Keyed by the version being migrated FROM. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  /**
   * 1 → 2: Stage 1 (training only) to Stage 2 (full season).
   *
   * Everything a version-1 save held is kept: audio settings, accessibility
   * settings and the whole training-progress block carry over untouched. The
   * new Stage 2 fields are added at their defaults, and the club the player
   * trained with is promoted to their season club so that a returning player
   * keeps their identity rather than starting from the club-selection screen.
   */
  1: (input) => {
    const progress =
      typeof input.progress === 'object' && input.progress !== null
        ? (input.progress as Record<string, unknown>)
        : {};
    const accessibility =
      typeof input.accessibility === 'object' && input.accessibility !== null
        ? (input.accessibility as Record<string, unknown>)
        : {};

    return {
      ...input,
      version: 2,
      // The Stage 1 club becomes the Stage 2 season club.
      playerTeamId: typeof progress.selectedTeamId === 'string' ? progress.selectedTeamId : null,
      difficulty: 'standard',
      // No season existed in Stage 1; the player starts a fresh one.
      season: null,
      fighterRecords: {},
      activeEvent: null,
      accessibility: {
        ...accessibility,
        // Fields introduced in version 2, defaulted to on.
        screenShake: true,
        announcementCaptions: true,
      },
    };
  },

  /**
   * 2 → 3: the Hobart roster was re-cast.
   *
   * Cathryn was retired and Bea Halloran now fills her junior slot. Every
   * reference to a retired fighter — the selected fighter, recorded bouts, an
   * event in progress and career records — is remapped to the replacement, so
   * no progress is lost and no screen can be handed an id that no longer
   * resolves. Everything else carries over untouched.
   */
  2: (input) => ({
    ...(remapRetiredFighters(input) as Record<string, unknown>),
    version: 3,
  }),
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
