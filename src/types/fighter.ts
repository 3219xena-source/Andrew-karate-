/**
 * Fighter data model.
 *
 * All fighters use this single record shape. Portraits, models, animations and
 * voice lines are referenced by configuration so that production assets can be
 * dropped in later without any component changes.
 *
 * IMPORTANT: every fighter in this game is a FICTIONALISED GAME AVATAR. Records
 * must not assert the real appearance, martial-arts ability, medical history,
 * personality or personal history of any real person. See `docs/CHARACTERS.md`.
 */

import type { TeamId } from './team.ts';

/**
 * Competition class. Junior competitors are only ever matched against other
 * juniors — see `matchmaking.ts`, which enforces this and is covered by tests.
 */
export type AgeClassification = 'junior' | 'adult' | 'senior';

/**
 * Weight division. These are the game's own fictional arcade divisions, not
 * the divisions of any real sanctioning body.
 */
export type WeightClass = 'junior-light' | 'lightweight' | 'middleweight' | 'heavyweight';

export const WEIGHT_CLASS_LABELS: Record<WeightClass, string> = {
  'junior-light': 'Junior',
  lightweight: 'Lightweight',
  middleweight: 'Middleweight',
  heavyweight: 'Heavyweight',
};

/**
 * Belt grade. Cosmetic and informational: it colours the procedural figure and
 * is shown on the roster, but it does not itself change combat handling — the
 * authored ratings do that.
 */
export type Belt = 'white' | 'yellow' | 'orange' | 'green' | 'blue' | 'brown' | 'black';

export const BELT_LABELS: Record<Belt, string> = {
  white: 'White belt',
  yellow: 'Yellow belt',
  orange: 'Orange belt',
  green: 'Green belt',
  blue: 'Blue belt',
  brown: 'Brown belt',
  black: 'Black belt',
};

/** Hex colour drawn for each belt by the procedural figure. */
export const BELT_COLOURS: Record<Belt, string> = {
  white: '#e8ecf2',
  yellow: '#e3c545',
  orange: '#e08a3a',
  green: '#3f9b62',
  blue: '#2f5fd0',
  brown: '#6b4630',
  black: '#12161d',
};

/** Broad competitive standard, shown alongside the belt. */
export type SkillTier = 'novice' | 'intermediate' | 'advanced' | 'expert';

export const SKILL_TIER_LABELS: Record<SkillTier, string> = {
  novice: 'Novice',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
};

/** Ratings are authored on a 1..100 scale and rendered as proportional bars. */
export type Rating = number;

/**
 * The six authored ratings.
 *
 * `strength` IS the fighter's power rating — it scales attack damage. The key
 * kept its Stage 1 name so that saves, tests and UI written against it stay
 * valid; the interface labels it "Power".
 */
export interface FighterStats {
  readonly strength: Rating;
  readonly speed: Rating;
  readonly defence: Rating;
  readonly technique: Rating;
  readonly stamina: Rating;
  readonly agility: Rating;
}

export const STAT_KEYS = [
  'strength',
  'speed',
  'defence',
  'technique',
  'stamina',
  'agility',
] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const STAT_LABELS: Record<StatKey, string> = {
  strength: 'Power',
  speed: 'Speed',
  defence: 'Defence',
  technique: 'Technique',
  stamina: 'Stamina',
  agility: 'Agility',
};

/**
 * How the AI plays this fighter. Profiles change spacing, aggression and
 * technique selection; they never grant hidden advantages.
 */
export type AiProfile =
  | 'aggressive'
  | 'defensive'
  | 'balanced'
  | 'evasive'
  | 'technical'
  | 'powerhouse';

/**
 * Animation configuration. Stage 2 ships one procedural animation set used by
 * every fighter; the field exists so per-fighter sprite sheets can be
 * introduced without a data migration.
 */
export interface AnimationConfig {
  readonly set: string;
  readonly speedScale: number;
  readonly beltColour: string;
  readonly giColour: string;
  readonly accentColour: string;
  /** Skin tone used by the procedural figure. Purely a visual variation. */
  readonly skinTone: string;
  /** Hair colour used by the procedural figure. */
  readonly hairColour: string;
  /** Silhouette variation: build affects the drawn figure's proportions. */
  readonly build: 'light' | 'medium' | 'heavy';
}

/** Voice-line configuration. No voice acting is recorded in this build. */
export interface VoiceConfig {
  readonly enabled: boolean;
  readonly bank: string;
  readonly lines: readonly string[];
}

/**
 * A fighter's signature technique, spent from the power meter. `damageScale`
 * multiplies the base power-attack damage in `match/constants.ts`.
 */
export interface SpecialMove {
  readonly name: string;
  readonly description: string;
  readonly damageScale: number;
  /** Visual treatment used by the arena renderer for the power flash. */
  readonly effect: 'strike' | 'sweep' | 'counter' | 'flurry';
}

/** Provenance of a fighter's artwork, mirrored into `docs/ASSET_REGISTER.md`. */
export interface ArtworkProvenance {
  /**
   * How the visible art was produced.
   * `procedural` — drawn at runtime by the game from configured colours.
   * `supplied`   — an image file provided by the project owner.
   */
  readonly method: 'procedural' | 'supplied';
  /** Who owns it. `owner` means the project owner supplied and cleared it. */
  readonly owner: 'project' | 'owner-supplied';
  readonly licence: 'MIT' | 'owner-supplied';
  /** True while the art is a stand-in for final artwork. */
  readonly placeholder: boolean;
  /** Alt text used wherever the image is rendered. */
  readonly altText?: string;
}

export interface Fighter {
  readonly id: string;
  readonly name: string;
  readonly teamId: TeamId;
  /** Position in the club's bout order, 0-based. Determines who fights whom. */
  readonly slot: number;
  readonly role: string;
  readonly relationship?: string;
  readonly ageClassification: AgeClassification;
  /** In-game age. Fictional, like every other field on this record. */
  readonly age: number;
  readonly weightClass: WeightClass;
  readonly belt: Belt;
  readonly skillTier: SkillTier;
  readonly biography: string;
  readonly fightingStyle: string;
  readonly strengths: string;
  readonly weaknesses: string;
  readonly stats: FighterStats;
  readonly specialAbility: SpecialMove;
  readonly aiProfile: AiProfile;
  readonly portraitAsset: string | null;
  readonly modelAsset: string | null;
  readonly animation: AnimationConfig;
  readonly voice: VoiceConfig;
  readonly artwork: ArtworkProvenance;
  readonly unlocked: boolean;
  readonly isPlaceholder: boolean;
  readonly playable: boolean;
}

/** A fighter's running competition record, tracked in the save file. */
export interface FighterRecord {
  readonly wins: number;
  readonly losses: number;
  readonly knockouts: number;
}

export const EMPTY_FIGHTER_RECORD: FighterRecord = { wins: 0, losses: 0, knockouts: 0 };
