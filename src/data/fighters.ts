/**
 * The championship roster: six clubs, six fighters each, thirty-six in total.
 *
 * ── Fictionalisation notice ──────────────────────────────────────────────────
 * Every character below is a FICTIONALISED GAME AVATAR created for this sport
 * game. Names, biographies, ratings, ages, fighting styles and appearances are
 * game content only. They do not describe, and must not be read as describing,
 * the real appearance, martial-arts ability, health, personality or personal
 * history of any real person.
 *
 * Names, biographies and appearances are intended to be replaceable. Edit this
 * file (or swap it for a loader that reads JSON) to re-cast any roster; no
 * interface component contains fighter text.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── Bout-order safety ────────────────────────────────────────────────────────
 * Every club fills the same six slots, in the same order, with the same
 * competition class and weight division (see SLOT_TEMPLATE). Because club
 * events pair fighters by slot, that guarantees every scheduled bout is
 * junior-versus-junior or adult/senior-versus-adult/senior, and never crosses
 * more than one weight division. `matchmaking.ts` re-checks this at runtime and
 * a test enforces it across all 36 records.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type {
  AiProfile,
  AnimationConfig,
  ArtworkProvenance,
  Fighter,
  FighterStats,
  SpecialMove,
  VoiceConfig,
  WeightClass,
} from '../types/fighter.ts';
import type { AgeClassification, StatKey } from '../types/fighter.ts';
import type { TeamId } from '../types/team.ts';
import { TEAMS } from './teams.ts';

/**
 * The competition class and weight division of each bout-order slot. Shared by
 * all six clubs so that slot-versus-slot pairings are always legal.
 */
export const SLOT_TEMPLATE: ReadonlyArray<{
  readonly ageClassification: AgeClassification;
  readonly weightClass: WeightClass;
}> = [
  { ageClassification: 'adult', weightClass: 'middleweight' },
  { ageClassification: 'junior', weightClass: 'junior-light' },
  { ageClassification: 'junior', weightClass: 'junior-light' },
  { ageClassification: 'senior', weightClass: 'middleweight' },
  { ageClassification: 'adult', weightClass: 'lightweight' },
  { ageClassification: 'senior', weightClass: 'lightweight' },
];

/** Stage 2 ships one procedural animation set; per-fighter sheets replace it. */
function animation(overrides: Partial<AnimationConfig>): AnimationConfig {
  return {
    set: 'stance:procedural-karate',
    speedScale: 1,
    beltColour: '#101418',
    giColour: '#eef1f5',
    accentColour: '#3f6fd6',
    skinTone: '#c98f68',
    hairColour: '#2b2119',
    build: 'medium',
    ...overrides,
  };
}

/** No voice acting is recorded in this build; every bank is declared, disabled. */
function voice(bank: string): VoiceConfig {
  return {
    enabled: false,
    bank: `audio/voice/${bank}`,
    lines: ['select', 'ready', 'light-attack', 'strong-attack', 'block', 'bow', 'victory'],
  };
}

/** All visible fighter art is procedural in this build. */
const PROCEDURAL_ART: ArtworkProvenance = {
  method: 'procedural',
  owner: 'project',
  licence: 'MIT',
  placeholder: true,
};

interface FighterSeed {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly relationship?: string;
  readonly age: number;
  readonly biography: string;
  readonly fightingStyle: string;
  readonly strengths: string;
  readonly weaknesses: string;
  readonly stats: FighterStats;
  readonly specialAbility: SpecialMove;
  readonly aiProfile: AiProfile;
  readonly look: Partial<AnimationConfig>;
}

const BUILD_BY_WEIGHT: Record<WeightClass, AnimationConfig['build']> = {
  'junior-light': 'light',
  lightweight: 'light',
  middleweight: 'medium',
  heavyweight: 'heavy',
};

/** Expands a club's six seeds into full fighter records. */
function buildRoster(teamId: TeamId, seeds: readonly FighterSeed[]): Fighter[] {
  const team = TEAMS.find((candidate) => candidate.id === teamId);
  if (!team) throw new Error(`Roster references unknown club "${teamId}"`);
  if (seeds.length !== SLOT_TEMPLATE.length) {
    throw new Error(`Club "${teamId}" must have exactly ${SLOT_TEMPLATE.length} fighters`);
  }

  return seeds.map((seed, slot) => {
    const template = SLOT_TEMPLATE[slot];
    if (!template) throw new Error(`No slot template for index ${slot}`);
    return {
      id: seed.id,
      name: seed.name,
      teamId,
      slot,
      role: seed.role,
      ...(seed.relationship ? { relationship: seed.relationship } : {}),
      ageClassification: template.ageClassification,
      age: seed.age,
      weightClass: template.weightClass,
      biography: seed.biography,
      fightingStyle: seed.fightingStyle,
      strengths: seed.strengths,
      weaknesses: seed.weaknesses,
      stats: seed.stats,
      specialAbility: seed.specialAbility,
      aiProfile: seed.aiProfile,
      portraitAsset: null,
      modelAsset: null,
      animation: animation({
        accentColour: team.colours.primary,
        build: BUILD_BY_WEIGHT[template.weightClass],
        ...seed.look,
      }),
      voice: voice(seed.id),
      artwork: PROCEDURAL_ART,
      unlocked: true,
      isPlaceholder: false,
      playable: true,
    } satisfies Fighter;
  });
}

// ── Hobart ───────────────────────────────────────────────────────────────────
// The Stage 1 featured roster, preserved and migrated into the Stage 2 model.

const HOBART: readonly FighterSeed[] = [
  {
    id: 'andrew-gillian',
    name: 'Andrew Gillian',
    role: 'Club captain and lead fighter',
    age: 41,
    biography:
      'Andrew leads the Hobart squad from the front, and is the club’s first choice in a close tie. He fights a balanced karate game with no obvious gap for an opponent to work on, and is at his most dangerous when he links techniques together.',
    fightingStyle: 'Balanced karate',
    strengths: 'Combination timing, ring craft, never rushed',
    weaknesses: 'Rarely gambles, so can be out-scored by pure speed',
    stats: { strength: 78, speed: 74, defence: 76, technique: 84, stamina: 79, agility: 72 },
    specialAbility: {
      name: 'Leader’s Combination',
      description: 'A three-part linked sequence that finishes with a committed reverse punch.',
      damageScale: 1.2,
      effect: 'flurry',
    },
    aiProfile: 'balanced',
    look: { beltColour: '#141922', hairColour: '#3a3128' },
  },
  {
    id: 'ales-gillian',
    name: 'Ales',
    role: 'Junior squad member',
    relationship: 'Andrew’s daughter',
    age: 13,
    biography:
      'Ales is the quickest mover in the Hobart squad and trains in the supervised junior class. She closes distance before an opponent has finished setting their stance, and rarely stands still long enough to be countered.',
    fightingStyle: 'Fast and agile karate',
    strengths: 'Footwork, entry speed, evasion',
    weaknesses: 'Light on power; must score many times to win a round',
    stats: { strength: 55, speed: 92, defence: 62, technique: 71, stamina: 74, agility: 94 },
    specialAbility: {
      name: 'Quick Step',
      description: 'A blurred switch-step into a snapping lead-hand strike.',
      damageScale: 1.05,
      effect: 'strike',
    },
    aiProfile: 'evasive',
    look: { giColour: '#f4f6fa', speedScale: 1.15, hairColour: '#5a3b22' },
  },
  {
    id: 'cathryn',
    name: 'Cathryn',
    role: 'Junior squad member',
    age: 14,
    biography:
      'Cathryn trains in the supervised junior class and is the squad’s most patient defender. She reads an incoming technique early, takes it on the guard or slips it, and answers immediately.',
    fightingStyle: 'Defensive karate',
    strengths: 'Guard discipline, counter timing, composure',
    weaknesses: 'Waits for openings rather than making them',
    stats: { strength: 57, speed: 76, defence: 88, technique: 74, stamina: 70, agility: 80 },
    specialAbility: {
      name: 'Read and Reply',
      description: 'A parry that rolls straight into a rising counter.',
      damageScale: 1.15,
      effect: 'counter',
    },
    aiProfile: 'defensive',
    look: { giColour: '#f4f6fa', hairColour: '#1f1a16' },
  },
  {
    id: 'mr-graham',
    name: 'Mr Graham',
    role: 'Head coach and senior competitor',
    relationship: 'Andrew’s father',
    age: 67,
    biography:
      'Mr Graham runs the Hobart training hall and still competes in the senior class. His karate is traditional and economical: a tight guard, correct distance, and nothing wasted.',
    fightingStyle: 'Traditional karate',
    strengths: 'Guard endurance, distance control, experience',
    weaknesses: 'Slowest mover in the division',
    stats: { strength: 72, speed: 58, defence: 90, technique: 88, stamina: 66, agility: 55 },
    specialAbility: {
      name: 'Coach’s Guard',
      description: 'An absorbing block that turns into a short, heavy elbow-line strike.',
      damageScale: 1.25,
      effect: 'counter',
    },
    aiProfile: 'defensive',
    look: { beltColour: '#141922', hairColour: '#b9b4ac' },
  },
  {
    id: 'janet-gillian',
    name: 'Janet',
    role: 'Squad strategist',
    relationship: 'Andrew’s wife',
    age: 39,
    biography:
      'Janet plans the squad’s approach to each tie and fights a precise technical game drawn from both karate and kung fu. She scores with accuracy rather than pressure.',
    fightingStyle: 'Technical karate and kung fu',
    strengths: 'Accuracy, timing, tactical reading',
    weaknesses: 'Can be pushed off her plan by relentless pressure',
    stats: { strength: 68, speed: 79, defence: 77, technique: 91, stamina: 75, agility: 78 },
    specialAbility: {
      name: 'Measured Timing',
      description: 'A late intercepting strike thrown into an opponent’s recovery.',
      damageScale: 1.2,
      effect: 'counter',
    },
    aiProfile: 'technical',
    look: { hairColour: '#2b2119' },
  },
  {
    id: 'mrs-graham',
    name: 'Mrs Graham',
    role: 'Senior competitor',
    relationship: 'Andrew’s mother',
    age: 64,
    biography:
      'Mrs Graham competes in the senior class and teaches the club’s balance and timing work. Her defensive karate is built on staying centred and answering late rather than early.',
    fightingStyle: 'Traditional defensive karate',
    strengths: 'Balance, late counters, unshakeable stance',
    weaknesses: 'Limited top speed over a long round',
    stats: { strength: 66, speed: 62, defence: 89, technique: 85, stamina: 71, agility: 60 },
    specialAbility: {
      name: 'Centred Balance',
      description: 'A pivot off the back foot into a sweeping low-line technique.',
      damageScale: 1.15,
      effect: 'sweep',
    },
    aiProfile: 'defensive',
    look: { hairColour: '#cfcac2' },
  },
];

// ── Launceston ───────────────────────────────────────────────────────────────

const LAUNCESTON: readonly FighterSeed[] = [
  {
    id: 'rowan-delacourt',
    name: 'Rowan Delacourt',
    role: 'Club captain',
    age: 34,
    biography:
      'Rowan captains the Tamar squad and is the club’s clearest expression of its philosophy: no favourite range, no favourite technique, and no obvious plan to scout.',
    fightingStyle: 'Adaptive karate',
    strengths: 'Range switching, mid-round adjustment',
    weaknesses: 'Master of everything, specialist in nothing',
    stats: { strength: 76, speed: 78, defence: 76, technique: 82, stamina: 76, agility: 76 },
    specialAbility: {
      name: 'Change of Plan',
      description: 'A feint at one range that lands as a committed strike at another.',
      damageScale: 1.2,
      effect: 'strike',
    },
    aiProfile: 'balanced',
    look: { hairColour: '#4a3a2a' },
  },
  {
    id: 'tessa-brightwell',
    name: 'Tessa Brightwell',
    role: 'Junior squad member',
    age: 13,
    biography:
      'Tessa came up through the Tamar junior programme and has already been asked to fight at three different ranges in a single tie. She enjoys the puzzle more than the winning.',
    fightingStyle: 'Adaptive karate',
    strengths: 'Problem solving, comfortable at any distance',
    weaknesses: 'Still building the strength to finish a round early',
    stats: { strength: 56, speed: 82, defence: 72, technique: 78, stamina: 74, agility: 84 },
    specialAbility: {
      name: 'Switch Lead',
      description: 'A stance change that arrives at the same moment as the strike.',
      damageScale: 1.1,
      effect: 'strike',
    },
    aiProfile: 'technical',
    look: { giColour: '#f4f6fa', hairColour: '#8a5c2e' },
  },
  {
    id: 'kai-nordholm',
    name: 'Kai Nordholm',
    role: 'Junior squad member',
    age: 14,
    biography:
      'Kai is the most physically confident junior in the northern clubs and prefers to take the centre of the mat early. His coaches are teaching him when not to.',
    fightingStyle: 'Forward-pressure karate',
    strengths: 'Pressure, taking the centre',
    weaknesses: 'Over-commits when he is ahead',
    stats: { strength: 68, speed: 74, defence: 66, technique: 70, stamina: 78, agility: 72 },
    specialAbility: {
      name: 'Drive Through',
      description: 'A straight-line advance behind a doubled lead hand.',
      damageScale: 1.2,
      effect: 'flurry',
    },
    aiProfile: 'aggressive',
    look: { giColour: '#f4f6fa', hairColour: '#d9c48a' },
  },
  {
    id: 'ellis-vance',
    name: 'Ellis Vance',
    role: 'Senior competitor',
    age: 61,
    biography:
      'Ellis has fought for Launceston in four decades and still keeps the tidiest guard in the senior division. He is the club’s benchmark for correct distance.',
    fightingStyle: 'Traditional karate',
    strengths: 'Distance, patience, guard integrity',
    weaknesses: 'Slow to close when he needs a score late',
    stats: { strength: 70, speed: 60, defence: 88, technique: 86, stamina: 68, agility: 58 },
    specialAbility: {
      name: 'Old Guard',
      description: 'A settled block that answers with a short, direct counter.',
      damageScale: 1.2,
      effect: 'counter',
    },
    aiProfile: 'defensive',
    look: { hairColour: '#a8a49c' },
  },
  {
    id: 'priya-raman',
    name: 'Priya Raman',
    role: 'Technical specialist',
    age: 29,
    biography:
      'Priya scouts every opponent the club will meet and fights the game she has planned. She is the reason Launceston are rarely surprised twice by the same technique.',
    fightingStyle: 'Analytical karate',
    strengths: 'Preparation, accuracy, counter selection',
    weaknesses: 'Less comfortable when the plan stops working',
    stats: { strength: 64, speed: 80, defence: 76, technique: 90, stamina: 74, agility: 80 },
    specialAbility: {
      name: 'Scouted Opening',
      description: 'A prepared answer to the technique an opponent throws most.',
      damageScale: 1.25,
      effect: 'counter',
    },
    aiProfile: 'technical',
    look: { hairColour: '#1a1512' },
  },
  {
    id: 'marta-iversen',
    name: 'Marta Iversen',
    role: 'Senior competitor',
    age: 58,
    biography:
      'Marta returned to competition after two decades coaching and brought a coach’s eye with her. She reads the round two techniques ahead of most opponents.',
    fightingStyle: 'Traditional counter karate',
    strengths: 'Anticipation, economy of movement',
    weaknesses: 'Limited output if forced to lead',
    stats: { strength: 62, speed: 66, defence: 84, technique: 86, stamina: 70, agility: 64 },
    specialAbility: {
      name: 'Two Ahead',
      description: 'A pre-emptive step into the gap an opponent is about to open.',
      damageScale: 1.15,
      effect: 'counter',
    },
    aiProfile: 'technical',
    look: { hairColour: '#c4bfb6' },
  },
];

// ── Devonport ────────────────────────────────────────────────────────────────

const DEVONPORT: readonly FighterSeed[] = [
  {
    id: 'nico-alvarez',
    name: 'Nico Alvarez',
    role: 'Club captain',
    age: 27,
    biography:
      'Nico sets the tempo for the coastal club, which is to say he sets it high. He would rather score four times moving than once standing still.',
    fightingStyle: 'Mobile karate',
    strengths: 'Entry speed, movement, tempo',
    weaknesses: 'Guard opens when he is tired',
    stats: { strength: 66, speed: 88, defence: 62, technique: 76, stamina: 74, agility: 88 },
    specialAbility: {
      name: 'Blur Entry',
      description: 'A skipping entry that covers the whole gap in one beat.',
      damageScale: 1.15,
      effect: 'strike',
    },
    aiProfile: 'aggressive',
    look: { hairColour: '#241c14' },
  },
  {
    id: 'freya-lindqvist',
    name: 'Freya Lindqvist',
    role: 'Junior squad member',
    age: 12,
    biography:
      'Freya is the youngest competitor on the circuit and the hardest junior to pin down. Her coaches describe her footwork as already better than her age.',
    fightingStyle: 'Evasive karate',
    strengths: 'Evasion, angles, recovery',
    weaknesses: 'Very light; must avoid exchanges entirely',
    stats: { strength: 48, speed: 90, defence: 62, technique: 70, stamina: 70, agility: 92 },
    specialAbility: {
      name: 'Off the Line',
      description: 'A sidestep that answers from an angle the opponent cannot see.',
      damageScale: 1.05,
      effect: 'counter',
    },
    aiProfile: 'evasive',
    look: { giColour: '#f4f6fa', speedScale: 1.15, hairColour: '#e0cf9a' },
  },
  {
    id: 'devon-okafor',
    name: 'Devon Okafor',
    role: 'Junior squad member',
    age: 14,
    biography:
      'Devon joined from the club’s athletics programme and brought the sprint start with him. He is at his best in the first thirty seconds of a round.',
    fightingStyle: 'Explosive karate',
    strengths: 'Acceleration, first exchange',
    weaknesses: 'Fades if a round goes long',
    stats: { strength: 64, speed: 86, defence: 60, technique: 68, stamina: 62, agility: 86 },
    specialAbility: {
      name: 'Sprint Start',
      description: 'An explosive first-beat entry from the opening whistle distance.',
      damageScale: 1.15,
      effect: 'strike',
    },
    aiProfile: 'aggressive',
    look: { giColour: '#f4f6fa', skinTone: '#7a4a2c', hairColour: '#140f0b' },
  },
  {
    id: 'sam-whitlock',
    name: 'Sam Whitlock',
    role: 'Senior competitor',
    age: 59,
    biography:
      'Sam has run the club’s Saturday session for eighteen years and still competes to prove the footwork drills work. They usually do.',
    fightingStyle: 'Traditional mobile karate',
    strengths: 'Footwork, timing, teaching-quality technique',
    weaknesses: 'Gives away power against bigger seniors',
    stats: { strength: 62, speed: 68, defence: 80, technique: 84, stamina: 68, agility: 70 },
    specialAbility: {
      name: 'Drill Perfect',
      description: 'The club’s signature entry, thrown exactly as coached.',
      damageScale: 1.15,
      effect: 'strike',
    },
    aiProfile: 'technical',
    look: { hairColour: '#b0aba2' },
  },
  {
    id: 'lena-petrov',
    name: 'Lena Petrov',
    role: 'Squad member',
    age: 25,
    biography:
      'Lena is the quickest adult on the north-west coast and scores from angles other competitors do not think are available.',
    fightingStyle: 'Angular karate',
    strengths: 'Angles, speed, unpredictability',
    weaknesses: 'Thin margin for error when a technique misses',
    stats: { strength: 58, speed: 88, defence: 66, technique: 78, stamina: 72, agility: 90 },
    specialAbility: {
      name: 'Cut the Angle',
      description: 'A wide step that arrives inside the opponent’s guard side.',
      damageScale: 1.1,
      effect: 'strike',
    },
    aiProfile: 'evasive',
    look: { hairColour: '#6b4a2a' },
  },
  {
    id: 'ruth-callender',
    name: 'Ruth Callender',
    role: 'Senior competitor',
    age: 56,
    biography:
      'Ruth came to karate late and treats every round as a problem with a tidy solution. She is the club’s most reliable scorer under pressure.',
    fightingStyle: 'Economical karate',
    strengths: 'Composure, efficiency',
    weaknesses: 'Little margin against heavier seniors',
    stats: { strength: 58, speed: 68, defence: 78, technique: 80, stamina: 72, agility: 68 },
    specialAbility: {
      name: 'Tidy Solution',
      description: 'A short, direct technique thrown at exactly the right beat.',
      damageScale: 1.1,
      effect: 'strike',
    },
    aiProfile: 'balanced',
    look: { hairColour: '#c9c3ba' },
  },
];

// ── Burnie ───────────────────────────────────────────────────────────────────

const BURNIE: readonly FighterSeed[] = [
  {
    id: 'bram-hollis',
    name: 'Bram Hollis',
    role: 'Club captain',
    age: 33,
    biography:
      'Bram has not been moved off the centre of a mat in three seasons. Opponents describe fighting him as running out of room very slowly.',
    fightingStyle: 'Pressure karate',
    strengths: 'Power, guard, refusing ground',
    weaknesses: 'Can be out-manoeuvred by genuine speed',
    stats: { strength: 90, speed: 62, defence: 88, technique: 76, stamina: 82, agility: 58 },
    specialAbility: {
      name: 'Immovable',
      description: 'An absorbed technique answered with a full-body driving strike.',
      damageScale: 1.35,
      effect: 'counter',
    },
    aiProfile: 'powerhouse',
    look: { hairColour: '#2a2018', build: 'heavy' },
  },
  {
    id: 'otis-kendrick',
    name: 'Otis Kendrick',
    role: 'Junior squad member',
    age: 14,
    biography:
      'Otis fights the club style already: guard up, feet planted, and a counter waiting. His coaches are working on adding a second gear.',
    fightingStyle: 'Defensive karate',
    strengths: 'Guard, patience, resilience',
    weaknesses: 'Rarely initiates',
    stats: { strength: 66, speed: 66, defence: 86, technique: 70, stamina: 78, agility: 62 },
    specialAbility: {
      name: 'Hold the Line',
      description: 'A braced guard that answers with a short driving punch.',
      damageScale: 1.2,
      effect: 'counter',
    },
    aiProfile: 'defensive',
    look: { giColour: '#f4f6fa', hairColour: '#7a5a34' },
  },
  {
    id: 'nadia-suvari',
    name: 'Nadia Suvari',
    role: 'Junior squad member',
    age: 13,
    biography:
      'Nadia is the exception in a defensive club — she leads, and she leads hard. The squad build their junior tactics around the space she creates.',
    fightingStyle: 'Aggressive karate',
    strengths: 'Initiative, combination volume',
    weaknesses: 'Spends stamina quickly',
    stats: { strength: 70, speed: 76, defence: 64, technique: 72, stamina: 68, agility: 76 },
    specialAbility: {
      name: 'Open the Door',
      description: 'A fast three-strike sequence that forces the guard up and then goes low.',
      damageScale: 1.2,
      effect: 'flurry',
    },
    aiProfile: 'aggressive',
    look: { giColour: '#f4f6fa', hairColour: '#241a12' },
  },
  {
    id: 'greta-lund',
    name: 'Greta Lund',
    role: 'Senior competitor',
    age: 62,
    biography:
      'Greta was Burnie’s first state-level competitor and still sets the club’s standard for a guard that does not break under sustained pressure.',
    fightingStyle: 'Traditional defensive karate',
    strengths: 'Guard endurance, counter power',
    weaknesses: 'Struggles to chase a deficit',
    stats: { strength: 78, speed: 56, defence: 92, technique: 82, stamina: 72, agility: 54 },
    specialAbility: {
      name: 'Wall and Answer',
      description: 'A settled absorbing guard followed by a heavy short technique.',
      damageScale: 1.3,
      effect: 'counter',
    },
    aiProfile: 'defensive',
    look: { hairColour: '#bdb8b0' },
  },
  {
    id: 'elias-renn',
    name: 'Elias Renn',
    role: 'Squad member',
    age: 30,
    biography:
      'Elias is the lightest fighter in the Burnie squad and the one who does most of the moving. He is the club’s answer to fast opponents.',
    fightingStyle: 'Counter karate',
    strengths: 'Counter timing, distance judgement',
    weaknesses: 'Gives away weight in the heavier ties',
    stats: { strength: 68, speed: 78, defence: 80, technique: 80, stamina: 74, agility: 78 },
    specialAbility: {
      name: 'Answer Back',
      description: 'A slipped technique returned along the same line.',
      damageScale: 1.2,
      effect: 'counter',
    },
    aiProfile: 'technical',
    look: { hairColour: '#3a2c1e' },
  },
  {
    id: 'owen-marsh',
    name: 'Owen Marsh',
    role: 'Senior competitor',
    age: 57,
    biography:
      'Owen spent twenty years in the club’s corner before returning to compete. He knows exactly how the Burnie game is supposed to look.',
    fightingStyle: 'Traditional karate',
    strengths: 'Guard, ring craft, corner-honed tactics',
    weaknesses: 'Limited speed against younger seniors',
    stats: { strength: 72, speed: 60, defence: 86, technique: 82, stamina: 72, agility: 58 },
    specialAbility: {
      name: 'Corner’s Plan',
      description: 'The technique the corner has been calling for all round.',
      damageScale: 1.25,
      effect: 'strike',
    },
    aiProfile: 'defensive',
    look: { hairColour: '#a9a49b' },
  },
];

// ── Smithton ─────────────────────────────────────────────────────────────────

const SMITHTON: readonly FighterSeed[] = [
  {
    id: 'ines-toledo',
    name: 'Ines Toledo',
    role: 'Club captain',
    age: 31,
    biography:
      'Ines captains the smallest squad on the circuit and is the reason they are never outlasted. She fights the third round exactly as she fought the first.',
    fightingStyle: 'Endurance karate',
    strengths: 'Conditioning, consistency, late-round scoring',
    weaknesses: 'Slow starter by design',
    stats: { strength: 70, speed: 70, defence: 78, technique: 78, stamina: 92, agility: 70 },
    specialAbility: {
      name: 'Third Round',
      description: 'A technique thrown with the same snap as the first minute.',
      damageScale: 1.2,
      effect: 'strike',
    },
    aiProfile: 'balanced',
    look: { hairColour: '#2a1f16' },
  },
  {
    id: 'jonah-pike',
    name: 'Jonah Pike',
    role: 'Junior squad member',
    age: 13,
    biography:
      'Jonah trains after school and has never once asked to stop early. His coaches say the conditioning will still be there when the technique catches up.',
    fightingStyle: 'Endurance karate',
    strengths: 'Stamina, persistence',
    weaknesses: 'Technique still developing',
    stats: { strength: 58, speed: 70, defence: 72, technique: 64, stamina: 88, agility: 72 },
    specialAbility: {
      name: 'Keep Going',
      description: 'A late-round burst thrown when the opponent expects a lull.',
      damageScale: 1.1,
      effect: 'flurry',
    },
    aiProfile: 'balanced',
    look: { giColour: '#f4f6fa', hairColour: '#8c6a3e' },
  },
  {
    id: 'aroha-nikau',
    name: 'Aroha Nikau',
    role: 'Junior squad member',
    age: 14,
    biography:
      'Aroha is the squad’s most complete junior and the one the club expects to captain it. She already fights the whole round rather than the exchange in front of her.',
    fightingStyle: 'Patient karate',
    strengths: 'Round management, composure',
    weaknesses: 'Can be too content to wait',
    stats: { strength: 62, speed: 74, defence: 78, technique: 76, stamina: 82, agility: 76 },
    specialAbility: {
      name: 'Chosen Moment',
      description: 'One committed technique after a long, deliberate wait.',
      damageScale: 1.2,
      effect: 'strike',
    },
    aiProfile: 'technical',
    look: { giColour: '#f4f6fa', skinTone: '#a06a44', hairColour: '#12100e' },
  },
  {
    id: 'colm-farrow',
    name: 'Colm Farrow',
    role: 'Senior competitor',
    age: 60,
    biography:
      'Colm drove the club’s competitors to every away tie for a decade before returning to the mat himself. He is the calmest presence in any venue.',
    fightingStyle: 'Traditional karate',
    strengths: 'Calm, pacing, stamina',
    weaknesses: 'Rarely explosive',
    stats: { strength: 68, speed: 60, defence: 82, technique: 80, stamina: 84, agility: 58 },
    specialAbility: {
      name: 'Long Road',
      description: 'A technique that arrives after the opponent has stopped expecting it.',
      damageScale: 1.2,
      effect: 'strike',
    },
    aiProfile: 'defensive',
    look: { hairColour: '#b5b0a7' },
  },
  {
    id: 'yara-bassam',
    name: 'Yara Bassam',
    role: 'Squad member',
    age: 26,
    biography:
      'Yara moved to the north-west for work and made the club’s numbers viable again. She is the fastest of the Smithton adults and their pressure option.',
    fightingStyle: 'Pressure karate',
    strengths: 'Work rate, sustained pressure',
    weaknesses: 'Guard is her second thought',
    stats: { strength: 66, speed: 80, defence: 68, technique: 76, stamina: 86, agility: 80 },
    specialAbility: {
      name: 'No Let Up',
      description: 'A sustained forward sequence that does not pause for a reset.',
      damageScale: 1.15,
      effect: 'flurry',
    },
    aiProfile: 'aggressive',
    look: { hairColour: '#1e1712' },
  },
  {
    id: 'mairead-quinn',
    name: 'Mairead Quinn',
    role: 'Senior competitor',
    age: 55,
    biography:
      'Mairead has competed for Smithton since the club had four members. She is the reason it still has six.',
    fightingStyle: 'Traditional karate',
    strengths: 'Endurance, persistence, club knowledge',
    weaknesses: 'Concedes power to heavier seniors',
    stats: { strength: 60, speed: 66, defence: 80, technique: 78, stamina: 86, agility: 66 },
    specialAbility: {
      name: 'Still Here',
      description: 'A last-minute scoring technique thrown at full commitment.',
      damageScale: 1.15,
      effect: 'strike',
    },
    aiProfile: 'balanced',
    look: { hairColour: '#c7c1b8' },
  },
];

// ── Rosebery ─────────────────────────────────────────────────────────────────

const ROSEBERY: readonly FighterSeed[] = [
  {
    id: 'zane-corrigan',
    name: 'Zane Corrigan',
    role: 'Club captain',
    age: 32,
    biography:
      'Zane cross-trains karate and kung fu in the same session and fights like it. Opponents rarely know which system the next technique is coming from.',
    fightingStyle: 'Mixed karate and kung fu',
    strengths: 'Counters, unpredictability, invited openings',
    weaknesses: 'Takes risks that occasionally do not pay',
    stats: { strength: 76, speed: 82, defence: 78, technique: 86, stamina: 76, agility: 84 },
    specialAbility: {
      name: 'Open Invitation',
      description: 'A deliberate opening that closes into a counter as it is taken.',
      damageScale: 1.3,
      effect: 'counter',
    },
    aiProfile: 'technical',
    look: { hairColour: '#211a14' },
  },
  {
    id: 'suki-tanaka-reid',
    name: 'Suki Tanaka-Reid',
    role: 'Junior squad member',
    age: 14,
    biography:
      'Suki trains in both of the club’s systems and switches between them mid-round, which is unusual for a junior and extremely difficult to scout.',
    fightingStyle: 'Mixed karate and kung fu',
    strengths: 'Style switching, counters',
    weaknesses: 'Occasionally too clever for the situation',
    stats: { strength: 60, speed: 82, defence: 74, technique: 82, stamina: 72, agility: 86 },
    specialAbility: {
      name: 'Change Systems',
      description: 'A karate entry that finishes as a kung-fu redirection.',
      damageScale: 1.2,
      effect: 'counter',
    },
    aiProfile: 'technical',
    look: { giColour: '#f4f6fa', hairColour: '#161210' },
  },
  {
    id: 'milo-bertrand',
    name: 'Milo Bertrand',
    role: 'Junior squad member',
    age: 13,
    biography:
      'Milo is the club’s most direct junior and its reminder that the counter game still needs somebody willing to lead.',
    fightingStyle: 'Direct karate',
    strengths: 'Directness, courage',
    weaknesses: 'Walks into counters he has been warned about',
    stats: { strength: 68, speed: 76, defence: 66, technique: 72, stamina: 74, agility: 78 },
    specialAbility: {
      name: 'Straight Ahead',
      description: 'A committed straight technique with no feint at all.',
      damageScale: 1.2,
      effect: 'strike',
    },
    aiProfile: 'aggressive',
    look: { giColour: '#f4f6fa', hairColour: '#6a4a26' },
  },
  {
    id: 'vera-ostrowski',
    name: 'Vera Ostrowski',
    role: 'Senior competitor',
    age: 63,
    biography:
      'Vera has fought on the west coast longer than the arena has stood. Her counter timing is the club’s teaching example.',
    fightingStyle: 'Traditional counter karate',
    strengths: 'Counter timing, patience, guile',
    weaknesses: 'Needs an opponent who leads',
    stats: { strength: 70, speed: 62, defence: 88, technique: 88, stamina: 70, agility: 62 },
    specialAbility: {
      name: 'Teaching Example',
      description: 'The counter the whole club has been drilled on, thrown perfectly.',
      damageScale: 1.3,
      effect: 'counter',
    },
    aiProfile: 'defensive',
    look: { hairColour: '#c2bcb3' },
  },
  {
    id: 'theo-nakamura',
    name: 'Theo Nakamura',
    role: 'Squad member',
    age: 28,
    biography:
      'Theo is the club’s specialist in the low line and the reason opponents keep their weight back against Rosebery.',
    fightingStyle: 'Low-line kung fu',
    strengths: 'Sweeps, low attacks, balance disruption',
    weaknesses: 'Vulnerable while committing low',
    stats: { strength: 70, speed: 80, defence: 74, technique: 84, stamina: 74, agility: 86 },
    specialAbility: {
      name: 'Low Sweep',
      description: 'A dropping sweep that takes the base out from under the guard.',
      damageScale: 1.25,
      effect: 'sweep',
    },
    aiProfile: 'evasive',
    look: { hairColour: '#171310' },
  },
  {
    id: 'hugh-ballantyne',
    name: 'Hugh Ballantyne',
    role: 'Senior competitor',
    age: 59,
    biography:
      'Hugh keeps the arena, coaches the juniors and still competes. On the west coast that is considered a normal amount of work.',
    fightingStyle: 'Traditional karate',
    strengths: 'Experience, counters, arena knowledge',
    weaknesses: 'Modest speed in the opening exchanges',
    stats: { strength: 66, speed: 64, defence: 84, technique: 84, stamina: 74, agility: 64 },
    specialAbility: {
      name: 'Home Advantage',
      description: 'A counter thrown with total familiarity with the floor.',
      damageScale: 1.2,
      effect: 'counter',
    },
    aiProfile: 'balanced',
    look: { hairColour: '#b8b2a9' },
  },
];

/** Every fighter in the championship, grouped by club in season order. */
export const FIGHTERS: readonly Fighter[] = [
  ...buildRoster('hobart', HOBART),
  ...buildRoster('launceston', LAUNCESTON),
  ...buildRoster('devonport', DEVONPORT),
  ...buildRoster('burnie', BURNIE),
  ...buildRoster('smithton', SMITHTON),
  ...buildRoster('rosebery', ROSEBERY),
];

const FIGHTER_INDEX: ReadonlyMap<string, Fighter> = new Map(
  FIGHTERS.map((fighter) => [fighter.id, fighter]),
);

const ROSTER_INDEX: ReadonlyMap<TeamId, readonly Fighter[]> = new Map(
  TEAMS.map((team) => [
    team.id,
    FIGHTERS.filter((fighter) => fighter.teamId === team.id).sort((a, b) => a.slot - b.slot),
  ]),
);

/** Returns the roster for `teamId`, in bout order. Empty for unknown clubs. */
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
 * Returns the fighter's highest-rated attributes, strongest first. Ties are
 * broken by the canonical stat order so the result is stable across renders.
 */
export function getStrongestStats(fighter: Fighter, count = 2): Array<[StatKey, number]> {
  const entries = Object.entries(fighter.stats) as Array<[StatKey, number]>;
  return entries.sort((a, b) => b[1] - a[1]).slice(0, count);
}
