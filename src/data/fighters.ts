/**
 * Fighter records.
 *
 * ── Fictionalisation notice ──────────────────────────────────────────────────
 * Every character below is a FICTIONALISED GAME AVATAR created for this sport
 * game. Names, biographies, ratings, fighting styles and appearances are game
 * content only. They do not describe, and must not be read as describing, the
 * real appearance, martial-arts ability, health, personality or personal
 * history of any real person.
 *
 * Names, biographies and appearances are intended to be replaced. Edit this
 * file (or swap it for a loader that reads JSON) to re-cast the roster; no
 * interface component contains fighter text.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { AnimationConfig, Fighter, VoiceConfig } from '../types/fighter.ts';
import type { Team, TeamId } from '../types/team.ts';
import { FEATURED_TEAM_ID, TEAMS } from './teams.ts';

/**
 * Stage 1 uses one procedural animation set for every fighter. Per-fighter
 * sprite sheets replace this without a data-model change.
 */
function animation(overrides: Partial<AnimationConfig>): AnimationConfig {
  return {
    set: 'stance:procedural-karate',
    speedScale: 1,
    beltColour: '#101418',
    giColour: '#eef1f5',
    accentColour: '#3f6fd6',
    ...overrides,
  };
}

/** Stage 1 ships no recorded voice acting; every bank is declared but disabled. */
function voice(bank: string): VoiceConfig {
  return {
    enabled: false,
    bank: `audio/voice/${bank}`,
    lines: ['select', 'ready', 'light-attack', 'strong-attack', 'block', 'bow', 'victory'],
  };
}

/**
 * The featured Hobart roster. This is the only fully authored team in Stage 1.
 */
const FEATURED_ROSTER: readonly Fighter[] = [
  {
    id: 'andrew-gillian',
    name: 'Andrew Gillian',
    teamId: FEATURED_TEAM_ID,
    role: 'Team leader and lead fighter',
    ageClassification: 'adult',
    biography:
      'Andrew leads the Hobart squad from the front, and is the club’s first choice in a close tie. He fights a balanced karate game with no obvious gap for an opponent to work on, and is at his most dangerous when he links techniques together. Team-mates describe him as disciplined, confident and protective of the younger students.',
    fightingStyle: 'Balanced karate',
    stats: { strength: 78, speed: 74, defence: 76, technique: 84, stamina: 79 },
    specialAbility: {
      name: 'Leader’s Combination',
      description:
        'Chained techniques score higher when linked cleanly, rewarding accurate combination timing.',
    },
    portraitAsset: null,
    modelAsset: null,
    animation: animation({ accentColour: '#3f6fd6', beltColour: '#141922' }),
    voice: voice('andrew-gillian'),
    unlocked: true,
    isPlaceholder: false,
    playable: true,
  },
  {
    id: 'ales-gillian',
    name: 'Ales',
    teamId: FEATURED_TEAM_ID,
    role: 'Junior martial-arts student',
    relationship: 'Andrew’s daughter',
    ageClassification: 'junior',
    biography:
      'Ales is the quickest mover in the Hobart squad and trains in the supervised junior class. She closes distance before an opponent has finished setting their stance, and rarely stands still long enough to be countered. Coaches note her courage and energy, and are working on asking her to slow down and pick her moment.',
    fightingStyle: 'Fast and agile karate',
    stats: { strength: 55, speed: 92, defence: 62, technique: 71, stamina: 74 },
    specialAbility: {
      name: 'Quick Step',
      description: 'Dodges recover faster and cost less stamina, allowing repeated evasive movement.',
    },
    portraitAsset: null,
    modelAsset: null,
    animation: animation({ accentColour: '#e0913a', giColour: '#f4f6fa', speedScale: 1.15 }),
    voice: voice('ales'),
    unlocked: true,
    isPlaceholder: false,
    playable: true,
  },
  {
    id: 'cathryn',
    name: 'Cathryn',
    teamId: FEATURED_TEAM_ID,
    role: 'Junior team member',
    ageClassification: 'junior',
    biography:
      'Cathryn trains in the supervised junior class and is the squad’s most patient defender. She reads an incoming technique early, takes it on the guard or slips it, and answers immediately. Calm and focused in training, she is the student most likely to have already spotted the pattern a coach is about to explain.',
    fightingStyle: 'Defensive karate',
    stats: { strength: 57, speed: 76, defence: 88, technique: 74, stamina: 70 },
    specialAbility: {
      name: 'Read and Reply',
      description: 'A successful block opens a short window where the next counter scores higher.',
    },
    portraitAsset: null,
    modelAsset: null,
    animation: animation({ accentColour: '#2f9c7c', giColour: '#f4f6fa' }),
    voice: voice('cathryn'),
    unlocked: true,
    isPlaceholder: false,
    playable: true,
  },
  {
    id: 'mr-graham',
    name: 'Mr Graham',
    teamId: FEATURED_TEAM_ID,
    role: 'Senior fighter and team coach',
    relationship: 'Andrew’s father',
    ageClassification: 'senior',
    biography:
      'Mr Graham runs the Hobart training hall and still competes in the senior class. His karate is traditional and economical: a tight guard, correct distance, and nothing wasted. He coaches the squad through the dojo sessions and is the voice new students hear first.',
    fightingStyle: 'Traditional karate',
    stats: { strength: 72, speed: 58, defence: 90, technique: 88, stamina: 66 },
    specialAbility: {
      name: 'Coach’s Guard',
      description: 'Blocking drains stamina more slowly, allowing longer defensive exchanges.',
    },
    portraitAsset: null,
    modelAsset: null,
    animation: animation({ accentColour: '#c9a227', beltColour: '#141922' }),
    voice: voice('mr-graham'),
    unlocked: true,
    isPlaceholder: false,
    playable: true,
  },
  {
    id: 'janet-gillian',
    name: 'Janet',
    teamId: FEATURED_TEAM_ID,
    role: 'Fighter and team strategist',
    relationship: 'Andrew’s wife',
    ageClassification: 'adult',
    biography:
      'Janet plans the squad’s approach to each tie and fights a precise technical game drawn from both karate and kung fu. She scores with accuracy rather than pressure, and her combinations are timed to land in the gap an opponent leaves on the way back to guard. Calm and supportive in the corner, exact on the mat.',
    fightingStyle: 'Technical karate and kung fu',
    stats: { strength: 68, speed: 79, defence: 77, technique: 91, stamina: 75 },
    specialAbility: {
      name: 'Measured Timing',
      description: 'Attacks landed at the end of an opponent’s technique score as clean counters.',
    },
    portraitAsset: null,
    modelAsset: null,
    animation: animation({ accentColour: '#8a6fd0' }),
    voice: voice('janet'),
    unlocked: true,
    isPlaceholder: false,
    playable: true,
  },
  {
    id: 'mrs-graham',
    name: 'Mrs Graham',
    teamId: FEATURED_TEAM_ID,
    role: 'Senior martial-arts fighter',
    relationship: 'Andrew’s mother',
    ageClassification: 'senior',
    biography:
      'Mrs Graham competes in the senior class and teaches the club’s balance and timing work. Her defensive karate is built on staying centred and answering late rather than early, and she is rarely moved off her stance. Composed on the mat and encouraging beside it.',
    fightingStyle: 'Traditional defensive karate',
    stats: { strength: 66, speed: 62, defence: 89, technique: 85, stamina: 71 },
    specialAbility: {
      name: 'Centred Balance',
      description: 'Recovery after a blocked or dodged technique is faster, keeping the guard intact.',
    },
    portraitAsset: null,
    modelAsset: null,
    animation: animation({ accentColour: '#4bb3c4' }),
    voice: voice('mrs-graham'),
    unlocked: true,
    isPlaceholder: false,
    playable: true,
  },
];

/**
 * Placeholder roster generator for clubs that are not yet authored.
 *
 * These are NOT production characters. They exist so that each club opens a
 * structurally valid roster screen, and every one is flagged `isPlaceholder`
 * so the UI can label it honestly. Stats are derived from the club profile so
 * the placeholder still reads as that club.
 */
const PLACEHOLDER_ROLES = [
  'Club captain',
  'Lead fighter',
  'Technical fighter',
  'Junior student',
  'Junior student',
  'Senior fighter and coach',
] as const;

const PLACEHOLDER_AGE_CLASSES = [
  'adult',
  'adult',
  'adult',
  'junior',
  'junior',
  'senior',
] as const;

/** Club profile biases, applied on top of a neutral 70 baseline. */
const TEAM_STAT_BIAS: Record<TeamId, Partial<Record<keyof Fighter['stats'], number>>> = {
  hobart: { technique: 12, defence: 4 },
  launceston: { technique: 6, speed: 4, defence: 4, stamina: 4 },
  devonport: { speed: 14, technique: 2 },
  burnie: { defence: 14, strength: 8, speed: -6 },
  smithton: { stamina: 15, defence: 5, strength: -4 },
  rosebery: { technique: 8, speed: 7, defence: 5, strength: -3 },
};

function buildPlaceholderRoster(team: Team): Fighter[] {
  const bias = TEAM_STAT_BIAS[team.id];
  return PLACEHOLDER_ROLES.map((role, index) => {
    // Small deterministic per-slot variation so cards are not identical.
    const wobble = ((index * 7) % 5) - 2;
    const base = 68 + wobble;
    const ageClassification = PLACEHOLDER_AGE_CLASSES[index] ?? 'adult';
    return {
      id: `${team.id}-recruit-${index + 1}`,
      name: `${team.shortName} Recruit ${index + 1}`,
      teamId: team.id,
      role,
      ageClassification,
      biography: `Roster placeholder for ${team.name}. This club’s six competitors are authored in Stage 2; the record exists so the club’s screens, data loading and navigation can be tested end to end.`,
      fightingStyle: team.style,
      stats: {
        strength: clampRating(base + (bias.strength ?? 0)),
        speed: clampRating(base + (bias.speed ?? 0)),
        defence: clampRating(base + (bias.defence ?? 0)),
        technique: clampRating(base + (bias.technique ?? 0)),
        stamina: clampRating(base + (bias.stamina ?? 0)),
      },
      specialAbility: {
        name: 'To be announced',
        description: `Signature technique reflecting the club strength: ${team.strength.toLowerCase()}.`,
      },
      portraitAsset: null,
      modelAsset: null,
      animation: animation({
        accentColour: team.emblem.primary,
        giColour: '#dfe4ec',
      }),
      voice: voice(`${team.id}-recruit-${index + 1}`),
      unlocked: false,
      isPlaceholder: true,
      playable: false,
    } satisfies Fighter;
  });
}

function clampRating(value: number): number {
  return Math.max(1, Math.min(100, Math.round(value)));
}

/** Every fighter in the game, featured roster first. */
export const FIGHTERS: readonly Fighter[] = [
  ...FEATURED_ROSTER,
  ...TEAMS.filter((team) => team.id !== FEATURED_TEAM_ID).flatMap(buildPlaceholderRoster),
];

const FIGHTER_INDEX: ReadonlyMap<string, Fighter> = new Map(
  FIGHTERS.map((fighter) => [fighter.id, fighter]),
);

const ROSTER_INDEX: ReadonlyMap<TeamId, readonly Fighter[]> = new Map(
  TEAMS.map((team) => [team.id, FIGHTERS.filter((fighter) => fighter.teamId === team.id)]),
);

/** Returns the roster for `teamId`. Returns an empty array for unknown teams. */
export function getRoster(teamId: TeamId | null | undefined): readonly Fighter[] {
  if (!teamId) return [];
  return ROSTER_INDEX.get(teamId) ?? [];
}

/** Returns the fighter with `id`, or `undefined` if no such fighter exists. */
export function getFighter(id: string | null | undefined): Fighter | undefined {
  if (!id) return undefined;
  return FIGHTER_INDEX.get(id);
}

/** True when `value` identifies a fighter that can currently be selected. */
export function isSelectableFighterId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const fighter = FIGHTER_INDEX.get(value);
  return fighter !== undefined && fighter.unlocked;
}

/**
 * Returns the fighter's two highest-rated attributes, strongest first. Ties are
 * broken by the canonical stat order so the result is stable across renders.
 */
export function getStrongestStats(fighter: Fighter, count = 2): Array<[keyof Fighter['stats'], number]> {
  const entries = Object.entries(fighter.stats) as Array<[keyof Fighter['stats'], number]>;
  return entries.sort((a, b) => b[1] - a[1]).slice(0, count);
}
