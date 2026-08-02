/**
 * Versioned save-file schema.
 *
 * The save system stores only game progress and audio preferences. It must
 * never store personal or sensitive information — no names typed by the player,
 * no contact details, no analytics identifiers.
 */

import type { TeamId } from './team.ts';

/**
 * Bump this whenever the shape of `SaveData` changes, and add a migration in
 * `src/systems/save/migrations.ts`.
 */
export const SAVE_VERSION = 1;

export const SAVE_STORAGE_KEY = 'tmac.save.v1';

export interface AudioSettings {
  /** Master switch. When false, nothing is audible regardless of the others. */
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
}

export interface ProgressData {
  readonly selectedTeamId: TeamId | null;
  readonly selectedFighterId: string | null;
  /** Objective ids the player has completed, in completion order. */
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
};

export const DEFAULT_PROGRESS: ProgressData = {
  selectedTeamId: null,
  selectedFighterId: null,
  completedObjectiveIds: [],
  tutorialComplete: false,
  stage1Complete: false,
  firstTournamentUnlocked: false,
};

export function createDefaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    audio: DEFAULT_AUDIO_SETTINGS,
    accessibility: DEFAULT_ACCESSIBILITY_SETTINGS,
    progress: DEFAULT_PROGRESS,
  };
}
