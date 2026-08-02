/**
 * Save manager.
 *
 * Stage 1 persists to `localStorage` under a single versioned key. The loader
 * is defensive by design: unavailable storage, missing keys, malformed JSON,
 * unknown versions and individually corrupt fields all resolve to a usable save
 * rather than an exception. Every recovery path is reported through the
 * returned `SaveLoadResult` — nothing is swallowed silently.
 *
 * Privacy: only game progress and audio/accessibility preferences are stored.
 * No personal or sensitive information is written, ever.
 */

import { isKnownTeamId } from '../../data/teams.ts';
import { getFighter } from '../../data/fighters.ts';
import {
  DEFAULT_ACCESSIBILITY_SETTINGS,
  DEFAULT_AUDIO_SETTINGS,
  DEFAULT_PROGRESS,
  SAVE_STORAGE_KEY,
  SAVE_VERSION,
  createDefaultSave,
  type AccessibilitySettings,
  type AudioSettings,
  type ProgressData,
  type SaveData,
} from '../../types/save.ts';
import { migrateSave } from './migrations.ts';

export type SaveLoadStatus =
  /** A valid save at the current version was loaded unchanged. */
  | 'loaded'
  /** No save existed; defaults were used. */
  | 'empty'
  /** An older save was migrated forward. */
  | 'migrated'
  /** The stored data was unreadable or invalid; defaults were used. */
  | 'recovered'
  /** Storage itself is unavailable; the session runs in memory only. */
  | 'unavailable';

export interface SaveLoadResult {
  readonly data: SaveData;
  readonly status: SaveLoadStatus;
  /** Human-readable explanation, present whenever status is not 'loaded'. */
  readonly detail?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clamp01(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Coerces arbitrary input into valid audio settings, field by field. */
export function sanitiseAudio(input: unknown): AudioSettings {
  if (!isRecord(input)) return DEFAULT_AUDIO_SETTINGS;
  return {
    masterEnabled: bool(input.masterEnabled, DEFAULT_AUDIO_SETTINGS.masterEnabled),
    musicEnabled: bool(input.musicEnabled, DEFAULT_AUDIO_SETTINGS.musicEnabled),
    sfxEnabled: bool(input.sfxEnabled, DEFAULT_AUDIO_SETTINGS.sfxEnabled),
    musicVolume: clamp01(input.musicVolume, DEFAULT_AUDIO_SETTINGS.musicVolume),
    sfxVolume: clamp01(input.sfxVolume, DEFAULT_AUDIO_SETTINGS.sfxVolume),
  };
}

export function sanitiseAccessibility(input: unknown): AccessibilitySettings {
  if (!isRecord(input)) return DEFAULT_ACCESSIBILITY_SETTINGS;
  return {
    reducedMotion: bool(input.reducedMotion, DEFAULT_ACCESSIBILITY_SETTINGS.reducedMotion),
  };
}

/**
 * Coerces arbitrary input into valid progress data. Team and fighter ids are
 * checked against the live content, so a save that names content which has been
 * removed or renamed degrades to "nothing selected" rather than crashing a
 * downstream screen.
 */
export function sanitiseProgress(input: unknown): ProgressData {
  if (!isRecord(input)) return DEFAULT_PROGRESS;

  const selectedTeamId = isKnownTeamId(input.selectedTeamId) ? input.selectedTeamId : null;

  const fighter = typeof input.selectedFighterId === 'string' ? getFighter(input.selectedFighterId) : undefined;
  // A fighter is only valid if it still exists AND still belongs to the saved team.
  const selectedFighterId =
    fighter && (!selectedTeamId || fighter.teamId === selectedTeamId) ? fighter.id : null;

  const completedObjectiveIds = Array.isArray(input.completedObjectiveIds)
    ? Array.from(
        new Set(input.completedObjectiveIds.filter((id): id is string => typeof id === 'string')),
      )
    : [];

  const tutorialComplete = bool(input.tutorialComplete, false);
  const stage1Complete = bool(input.stage1Complete, false) && tutorialComplete;

  return {
    selectedTeamId,
    selectedFighterId,
    completedObjectiveIds,
    tutorialComplete,
    stage1Complete,
    // The tournament unlock is derived, never trusted from disk: a hand-edited
    // save cannot unlock content the player has not actually completed.
    firstTournamentUnlocked: stage1Complete,
  };
}

function sanitiseSave(input: unknown): SaveData {
  const record = isRecord(input) ? input : {};
  return {
    version: SAVE_VERSION,
    audio: sanitiseAudio(record.audio),
    accessibility: sanitiseAccessibility(record.accessibility),
    progress: sanitiseProgress(record.progress),
  };
}

/** Returns the storage backend, or null when it is unavailable or blocked. */
function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    // Safari private mode and some enterprise policies throw on write, not on
    // access, so probe with a real round trip.
    const probe = '__tmac_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadSave(): SaveLoadResult {
  const storage = getStorage();
  if (!storage) {
    return {
      data: createDefaultSave(),
      status: 'unavailable',
      detail:
        'Browser storage is unavailable, so progress and audio settings will not persist after a refresh.',
    };
  }

  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_STORAGE_KEY);
  } catch (error) {
    console.warn('[save] could not read from storage', error);
    return {
      data: createDefaultSave(),
      status: 'unavailable',
      detail: 'Browser storage could not be read, so this session will not be saved.',
    };
  }

  if (raw === null) {
    return { data: createDefaultSave(), status: 'empty' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn('[save] stored data was not valid JSON; starting a fresh save');
    return {
      data: createDefaultSave(),
      status: 'recovered',
      detail: 'Saved data could not be read and has been reset. Your settings return to their defaults.',
    };
  }

  if (!isRecord(parsed)) {
    return {
      data: createDefaultSave(),
      status: 'recovered',
      detail: 'Saved data was not in the expected format and has been reset.',
    };
  }

  const storedVersion = typeof parsed.version === 'number' ? parsed.version : null;

  if (storedVersion === null || storedVersion < 1 || storedVersion > SAVE_VERSION) {
    return {
      data: sanitiseSave(parsed),
      status: 'recovered',
      detail: `Saved data reported version ${String(parsed.version)}, which this build cannot read. Recoverable settings were kept and the rest was reset.`,
    };
  }

  if (storedVersion < SAVE_VERSION) {
    const migrated = migrateSave(parsed, storedVersion);
    return {
      data: sanitiseSave(migrated),
      status: 'migrated',
      detail: `Saved data was upgraded from version ${storedVersion} to ${SAVE_VERSION}.`,
    };
  }

  return { data: sanitiseSave(parsed), status: 'loaded' };
}

/** Persists `data`. Returns false when storage rejected the write. */
export function writeSave(data: SaveData): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    // Quota exhaustion is the usual cause. Report it rather than pretending the
    // save succeeded.
    console.warn('[save] could not write to storage', error);
    return false;
  }
}

/** Removes the save entirely. Returns false when storage rejected the delete. */
export function clearSave(): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.removeItem(SAVE_STORAGE_KEY);
    return true;
  } catch (error) {
    console.warn('[save] could not clear storage', error);
    return false;
  }
}
