/**
 * Fighter data model.
 *
 * All fighters — playable, placeholder and future opponents — use this single
 * record shape. Portraits, models, animations and voice lines are referenced by
 * configuration so that production assets can be dropped in later without any
 * component changes.
 *
 * IMPORTANT: every fighter in this game is a FICTIONALISED GAME AVATAR. Records
 * must not assert the real appearance, martial-arts ability, medical history,
 * personality or personal history of any real person. See `docs/CHARACTERS.md`.
 */

import type { TeamId } from './team.ts';

/**
 * Competition class. Junior characters train under supervision and are matched
 * only within their own class — see `docs/KNOWN_LIMITATIONS.md` for the Stage 2
 * competition-class rules.
 */
export type AgeClassification = 'junior' | 'adult' | 'senior';

/** Ratings are authored on a 1..100 scale and rendered as proportional bars. */
export type Rating = number;

export interface FighterStats {
  readonly strength: Rating;
  readonly speed: Rating;
  readonly defence: Rating;
  readonly technique: Rating;
  readonly stamina: Rating;
}

/** Keys of `FighterStats`, useful for generic stat rendering. */
export const STAT_KEYS = ['strength', 'speed', 'defence', 'technique', 'stamina'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const STAT_LABELS: Record<StatKey, string> = {
  strength: 'Strength',
  speed: 'Speed',
  defence: 'Defence',
  technique: 'Technique',
  stamina: 'Stamina',
};

/**
 * Animation configuration. Stage 1 ships a single procedural animation set
 * (`stance:procedural-karate`) used by every fighter; the field exists so that
 * per-fighter sprite sheets can be introduced without a data migration.
 */
export interface AnimationConfig {
  /** Identifier of the animation set to use. */
  readonly set: string;
  /** Multiplier applied to animation playback speed (1 = authored speed). */
  readonly speedScale: number;
  /** Belt colour used by the procedural renderer. */
  readonly beltColour: string;
  /** Gi (uniform) colour used by the procedural renderer. */
  readonly giColour: string;
  /** Accent colour for trim and headband. */
  readonly accentColour: string;
}

/**
 * Voice-line configuration. Stage 1 has no recorded voice acting; `enabled` is
 * false for every fighter and the fields document the eventual contract.
 */
export interface VoiceConfig {
  readonly enabled: boolean;
  /** Directory that will hold this fighter's voice clips. */
  readonly bank: string;
  /** Clip identifiers expected in that bank. */
  readonly lines: readonly string[];
}

export interface SpecialAbility {
  readonly name: string;
  readonly description: string;
}

export interface Fighter {
  readonly id: string;
  readonly name: string;
  readonly teamId: TeamId;
  /** Role within the team, e.g. "Team leader". */
  readonly role: string;
  /** Family or club relationship shown on the profile panel. Optional. */
  readonly relationship?: string;
  readonly ageClassification: AgeClassification;
  /** Two-to-four sentence in-game biography. */
  readonly biography: string;
  readonly fightingStyle: string;
  readonly stats: FighterStats;
  readonly specialAbility: SpecialAbility;
  /**
   * Portrait asset path. Stage 1 uses `null`, which makes the UI render the
   * procedural placeholder portrait instead of a missing-image box.
   */
  readonly portraitAsset: string | null;
  /** Character-model asset path. `null` selects the procedural canvas fighter. */
  readonly modelAsset: string | null;
  readonly animation: AnimationConfig;
  readonly voice: VoiceConfig;
  /** Whether the fighter can be selected in the current build. */
  readonly unlocked: boolean;
  /**
   * True for auto-generated roster placeholders. The UI labels these clearly so
   * that a placeholder is never mistaken for authored content.
   */
  readonly isPlaceholder: boolean;
  /**
   * True when the fighter is fully driven by the Stage 1 dojo controller.
   * Stage 1 limitation: all featured fighters share one controller and one
   * procedural animation set; their stats change handling, not their moveset.
   */
  readonly playable: boolean;
}
