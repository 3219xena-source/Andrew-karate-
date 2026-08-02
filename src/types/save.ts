/**
 * Versioned save-file schema.
 *
 * The save system stores only game progress and preferences. It must never
 * store personal or sensitive information — no names typed by the player, no
 * contact details, no analytics identifiers.
 *
 * Version 2 adds the Stage 2 season. Version 1 saves are migrated forward by
 * `systems/save/migrations.ts`; see `docs/SAVE_MIGRATION.md`.
 */

import type { Difficulty } from '../systems/ai/opponentAI.ts';
import type { FighterRecord } from './fighter.ts';
import type { BoutResult, SeasonState } from './season.ts';
import type { TeamId } from './team.ts';

/** Bump whenever `SaveData` changes, and add a migration. */
export const SAVE_VERSION = 2;

export const SAVE_STORAGE_KEY = 'tmac.save.v1';

export interface AudioSettings {
  readonly masterEnabled: boolean;
  readonly musicEnabled: boolean;
  readonly sfxEnabled: boolean;
  /** 0..1 */
  readonly musicVolume: number;
  /** 0..1 */
  readonly sfxVolume: number;
}

export interface AccessibilitySettings {
  /**
   * When true, non-essential motion is suppressed. Initialised from the
   * `prefers-reduced-motion` media query and overridable in Settings.
   */
  readonly reducedMotion: boolean;
  /** Suppresses the arena's restrained impact shake. */
  readonly screenShake: boolean;
  /** Shows on-screen text for every announcement the referee makes. */
  readonly announcementCaptions: boolean;
}

/** Stage 1 training progress. Preserved unchanged from version 1. */
export interface ProgressData {
  readonly selectedTeamId: TeamId | null;
  readonly selectedFighterId: string | null;
  readonly completedObjectiveIds: readonly string[];
  readonly tutorialComplete: boolean;
  readonly stage1Complete: boolean;
  readonly firstTournamentUnlocked: boolean;
}

export interface SaveData {
  readonly version: number;
  readonly audio: AudioSettings;
  readonly accessibility: AccessibilitySettings;
  readonly progress: ProgressData;
  /** The club the player represents this season. */
  readonly playerTeamId: TeamId | null;
  readonly difficulty: Difficulty;
  /** Null until a season has been started. */
  readonly season: SeasonState | null;
  /** Career record per fighter id. */
  readonly fighterRecords: Readonly<Record<string, FighterRecord>>;
  /**
   * A club event that has been started but not finished.
   *
   * Completed bouts are kept so a refresh mid-event does not cost the player
   * the bouts they already won. The bout that was in progress is NOT saved and
   * restarts from round one — see `docs/SAVE_MIGRATION.md`.
   */
  readonly activeEvent: ActiveEventSave | null;
}

export interface ActiveEventSave {
  readonly eventId: string;
  readonly bouts: readonly BoutResult[];
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterEnabled: true,
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 0.5,
  sfxVolume: 0.7,
};

export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  reducedMotion: false,
  screenShake: true,
  announcementCaptions: true,
};

export const DEFAULT_PROGRESS: ProgressData = {
  selectedTeamId: null,
  selectedFighterId: null,
  completedObjectiveIds: [],
  tutorialComplete: false,
  stage1Complete: false,
  firstTournamentUnlocked: false,
};

export const DEFAULT_DIFFICULTY: Difficulty = 'standard';

export function createDefaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    audio: DEFAULT_AUDIO_SETTINGS,
    accessibility: DEFAULT_ACCESSIBILITY_SETTINGS,
    progress: DEFAULT_PROGRESS,
    playerTeamId: null,
    difficulty: DEFAULT_DIFFICULTY,
    season: null,
    fighterRecords: {},
    activeEvent: null,
  };
}
