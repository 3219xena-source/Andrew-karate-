/**
 * The six competition venues.
 *
 * Each is a FICTIONAL competition hall inspired by its Tasmanian location. No
 * claim is made about any real building, and no real building's appearance is
 * reproduced. Every visual property here feeds the procedural arena renderer;
 * there are no image files.
 */

import type { Venue } from '../types/venue.ts';

export const VENUES: readonly Venue[] = [
  {
    id: 'hobart-arena',
    name: 'Southern Mountain Arena',
    location: 'Hobart',
    homeTeamId: 'hobart',
    description:
      'The championship hall beneath the mountain, and the traditional home of the Tasmania final. Steep banked seating on three sides puts the crowd close to the mat.',
    atmosphere: 'A full house under the mountain, and the loudest room in the state.',
    capacity: 3200,
    palette: {
      wallTop: '#101c30',
      wallBottom: '#1b2c46',
      matPrimary: '#2f5a92',
      matSecondary: '#22406b',
      trim: '#4d86e8',
      crowd: '#0c1524',
      accent: '#d8a83c',
    },
    motif: 'mountain',
    bannerText: 'TASMANIA CHAMPIONSHIP',
  },
  {
    id: 'launceston-hall',
    name: 'Tamar Heritage Hall',
    location: 'Launceston',
    homeTeamId: 'launceston',
    description:
      'A tall brick sports hall with arched windows along the north wall. Sound carries, so every scoring technique is heard as well as seen.',
    atmosphere: 'Arched windows, high ceilings, and a crowd that knows the rules.',
    capacity: 1800,
    palette: {
      wallTop: '#12241f',
      wallBottom: '#1d3a31',
      matPrimary: '#2f7a63',
      matSecondary: '#215747',
      trim: '#2f9c7c',
      crowd: '#0a1815',
      accent: '#7fe0c0',
    },
    motif: 'heritage-arches',
    bannerText: 'TAMAR OPEN',
  },
  {
    id: 'devonport-pavilion',
    name: 'Coastal Pavilion',
    location: 'Devonport',
    homeTeamId: 'devonport',
    description:
      'A bright waterfront pavilion with a glazed north wall. Competitors say the light off the water makes distance easy to read.',
    atmosphere: 'Sea light through the glass, and a fast floor to match.',
    capacity: 1400,
    palette: {
      wallTop: '#1d1608',
      wallBottom: '#33240d',
      matPrimary: '#9a6b28',
      matSecondary: '#6f4c1c',
      trim: '#e0913a',
      crowd: '#171006',
      accent: '#ffd191',
    },
    motif: 'coastal-windows',
    bannerText: 'COASTAL CLASSIC',
  },
  {
    id: 'burnie-centre',
    name: 'Emu Bay Sports Centre',
    location: 'Burnie',
    homeTeamId: 'burnie',
    description:
      'A converted industrial hall with exposed roof trusses and a hard, fast competition surface. A difficult place to be pushed backwards.',
    atmosphere: 'Steel trusses overhead and a crowd that rewards a stubborn guard.',
    capacity: 2100,
    palette: {
      wallTop: '#241010',
      wallBottom: '#3a1c1a',
      matPrimary: '#8f3f3a',
      matSecondary: '#6a2e2a',
      trim: '#c05a54',
      crowd: '#180b0a',
      accent: '#ffa79f',
    },
    motif: 'industrial-trusses',
    bannerText: 'EMU BAY SHIELD',
  },
  {
    id: 'smithton-dojo',
    name: 'Circular Head Dojo',
    location: 'Smithton',
    homeTeamId: 'smithton',
    description:
      'A timber-framed regional dojo with a sprung floor and a single long banner wall. The smallest venue on the circuit and the most traditional.',
    atmosphere: 'Warm timber, a sprung floor, and a patient north-west crowd.',
    capacity: 700,
    palette: {
      wallTop: '#1a1428',
      wallBottom: '#2a2140',
      matPrimary: '#5d4a92',
      matSecondary: '#453569',
      trim: '#8a6fd0',
      crowd: '#120e1e',
      accent: '#c9b6ff',
    },
    motif: 'timber-hall',
    bannerText: 'CIRCULAR HEAD INVITATIONAL',
  },
  {
    id: 'rosebery-arena',
    name: 'West Coast Community Arena',
    location: 'Rosebery',
    homeTeamId: 'rosebery',
    description:
      'A mountain community arena built into the hillside, with lighting rigs slung low over the mat. Cold outside, and famously loud inside.',
    atmosphere: 'Low rigs, close walls, and the most partisan crowd in Tasmania.',
    capacity: 900,
    palette: {
      wallTop: '#0a2026',
      wallBottom: '#123640',
      matPrimary: '#2b7f8d',
      matSecondary: '#1f5f6b',
      trim: '#4bb3c4',
      crowd: '#07161a',
      accent: '#a7ecf6',
    },
    motif: 'alpine-lodge',
    bannerText: 'WEST COAST CUP',
  },
];

const VENUE_INDEX: ReadonlyMap<string, Venue> = new Map(VENUES.map((venue) => [venue.id, venue]));

export function getVenue(id: string | null | undefined): Venue | undefined {
  if (!id) return undefined;
  return VENUE_INDEX.get(id);
}
