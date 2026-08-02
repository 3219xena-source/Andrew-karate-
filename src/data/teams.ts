/**
 * The six Tasmanian championship clubs.
 *
 * Editing this file is the supported way to rename clubs, change their
 * identities or move their map markers. No component reads team text from
 * anywhere else.
 *
 * Every club is written as a positive, professional sporting organisation. Do
 * not introduce negative portrayals of Tasmanian locations, and do not use
 * cultural, racial, regional, gender or age stereotypes.
 */

import type { Team, TeamId } from '../types/team.ts';

export const TEAMS: readonly Team[] = [
  {
    id: 'hobart',
    location: 'Hobart',
    name: 'Hobart Southern Dojo',
    shortName: 'Hobart',
    emblem: { glyph: '◆', primary: '#3f6fd6', secondary: '#0e1b33' },
    style: 'Tactical and disciplined',
    strength: 'Technique',
    personality: 'Professional and organised',
    speciality: 'Precision scoring and controlled distance work',
    description:
      'Tasmania’s southern club trains under the mountain with a reputation for clean, well-judged technique. Sessions run to a strict plan, and every point is earned through control rather than force. Hobart is the featured club of this build.',
    status: 'featured',
    mapPosition: { x: 55, y: 76 },
    labelAnchor: 'start',
  },
  {
    id: 'launceston',
    location: 'Launceston',
    name: 'Launceston Tamar Karate Club',
    shortName: 'Launceston',
    emblem: { glyph: '▲', primary: '#2f9c7c', secondary: '#0b2620' },
    style: 'Balanced and technical',
    strength: 'Adaptability',
    personality: 'Composed and strategic',
    speciality: 'Reading an opponent and changing plan mid-round',
    description:
      'A northern club known for producing complete competitors who are comfortable at every range. Launceston coaches drill adaptability above all, so their fighters rarely need a favourite technique to win a round.',
    status: 'scouted',
    mapPosition: { x: 59, y: 34 },
    labelAnchor: 'start',
  },
  {
    id: 'devonport',
    location: 'Devonport',
    name: 'Devonport Coastal Martial Arts',
    shortName: 'Devonport',
    emblem: { glyph: '●', primary: '#e0913a', secondary: '#33200a' },
    style: 'Fast and agile',
    strength: 'Movement',
    personality: 'Energetic and responsive',
    speciality: 'Rapid entries and quick footwork exchanges',
    description:
      'A busy coastal club whose training hall is rarely still. Devonport competitors are drilled in footwork first, and they are happiest scoring on the move before an opponent has settled into a stance.',
    status: 'scouted',
    mapPosition: { x: 48, y: 22 },
    labelAnchor: 'start',
  },
  {
    id: 'burnie',
    location: 'Burnie',
    name: 'Burnie Emu Bay Karate',
    shortName: 'Burnie',
    emblem: { glyph: '■', primary: '#c05a54', secondary: '#2e0f0e' },
    style: 'Strong and defensive',
    strength: 'Resistance and blocking',
    personality: 'Determined and powerful',
    speciality: 'Holding the centre and absorbing pressure',
    description:
      'Burnie build their competitors from the guard outwards. Their squad is famous for refusing to give ground, and for turning a long defensive exchange into a single decisive scoring technique.',
    status: 'scouted',
    mapPosition: { x: 33, y: 29 },
    labelAnchor: 'start',
  },
  {
    id: 'smithton',
    location: 'Smithton',
    name: 'Smithton Circular Head Dojo',
    shortName: 'Smithton',
    emblem: { glyph: '✦', primary: '#8a6fd0', secondary: '#1c1330' },
    style: 'Patient and resilient',
    strength: 'Stamina',
    personality: 'Calm and persistent',
    speciality: 'Late-round conditioning and unbroken pace',
    description:
      'The far north-west club trains for the length of the tournament, not the length of the round. Smithton fighters are typically as steady in a final as they were in their first bout of the day.',
    status: 'scouted',
    mapPosition: { x: 21, y: 22 },
    labelAnchor: 'start',
  },
  {
    id: 'rosebery',
    location: 'Rosebery',
    name: 'Rosebery West Coast Kung Fu & Karate',
    shortName: 'Rosebery',
    emblem: { glyph: '✵', primary: '#4bb3c4', secondary: '#08262b' },
    style: 'Unpredictable and adaptable',
    strength: 'Counterattacks',
    personality: 'Resourceful and courageous',
    speciality: 'Inviting an attack and answering it immediately',
    description:
      'A small west-coast club that turns limited numbers into an advantage, cross-training karate and kung fu in the same session. Rosebery competitors are hardest to score against when they appear to be giving an opening away.',
    status: 'scouted',
    mapPosition: { x: 25, y: 48 },
    labelAnchor: 'end',
  },
];

/** The club whose roster is fully authored and playable in Stage 1. */
export const FEATURED_TEAM_ID: TeamId = 'hobart';

const TEAM_INDEX: ReadonlyMap<TeamId, Team> = new Map(TEAMS.map((team) => [team.id, team]));

/** Returns the team with `id`, or `undefined` if no such team exists. */
export function getTeam(id: TeamId | null | undefined): Team | undefined {
  if (!id) return undefined;
  return TEAM_INDEX.get(id);
}

/** True when `value` is a known team id. Used to validate loaded save data. */
export function isKnownTeamId(value: unknown): value is TeamId {
  return typeof value === 'string' && TEAM_INDEX.has(value as TeamId);
}
