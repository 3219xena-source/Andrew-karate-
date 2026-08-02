/**
 * Matchmaking safety rules.
 *
 * These are the game's own fictional arcade competition rules. They are not,
 * and do not claim to be, the regulations of any real karate sanctioning body.
 *
 * The rule that matters most: a junior competitor is NEVER matched against an
 * adult or senior competitor. Every scheduled bout passes through
 * `validatePairing` before it can start, and the club-event controller refuses
 * to build an illegal bout order.
 */

import type { AgeClassification, Fighter, WeightClass } from '../../types/fighter.ts';

/** Weight divisions in ascending order, used to measure the gap between two. */
const WEIGHT_ORDER: readonly WeightClass[] = [
  'junior-light',
  'lightweight',
  'middleweight',
  'heavyweight',
];

/**
 * Competition classes that may face each other. Juniors are isolated; adults
 * and seniors share the open division, which is standard for club competition
 * and is how this game's fictional rules are written.
 */
const COMPATIBLE_CLASSES: Record<AgeClassification, readonly AgeClassification[]> = {
  junior: ['junior'],
  adult: ['adult', 'senior'],
  senior: ['adult', 'senior'],
};

/** Largest permitted gap between two weight divisions in one bout. */
export const MAX_WEIGHT_GAP = 1;

export type PairingRejection =
  | 'same-fighter'
  | 'junior-versus-open'
  | 'incompatible-class'
  | 'weight-gap-too-large';

export interface PairingResult {
  readonly legal: boolean;
  readonly reason?: PairingRejection;
  /** Player-facing explanation, shown when a bout cannot be scheduled. */
  readonly message?: string;
}

const LEGAL: PairingResult = { legal: true };

/**
 * Checks whether two fighters may compete against each other.
 *
 * Returns a structured result rather than throwing, so callers can present the
 * reason instead of failing silently.
 */
export function validatePairing(a: Fighter, b: Fighter): PairingResult {
  if (a.id === b.id) {
    return {
      legal: false,
      reason: 'same-fighter',
      message: 'A fighter cannot be matched against themselves.',
    };
  }

  const aJunior = a.ageClassification === 'junior';
  const bJunior = b.ageClassification === 'junior';

  if (aJunior !== bJunior) {
    return {
      legal: false,
      reason: 'junior-versus-open',
      message:
        'Junior competitors only compete against other juniors. This pairing is not permitted.',
    };
  }

  const compatible = COMPATIBLE_CLASSES[a.ageClassification];
  if (!compatible.includes(b.ageClassification)) {
    return {
      legal: false,
      reason: 'incompatible-class',
      message: `${a.name} and ${b.name} compete in different classes.`,
    };
  }

  const aIndex = WEIGHT_ORDER.indexOf(a.weightClass);
  const bIndex = WEIGHT_ORDER.indexOf(b.weightClass);
  if (aIndex === -1 || bIndex === -1 || Math.abs(aIndex - bIndex) > MAX_WEIGHT_GAP) {
    return {
      legal: false,
      reason: 'weight-gap-too-large',
      message: `${a.name} and ${b.name} are too far apart in weight division.`,
    };
  }

  return LEGAL;
}

export interface BoutPairing {
  readonly index: number;
  readonly player: Fighter;
  readonly opponent: Fighter;
}

export interface BoutOrderResult {
  readonly pairings: readonly BoutPairing[];
  /** Pairings that were rejected, with the reason. Empty in a valid season. */
  readonly rejected: ReadonlyArray<{ index: number; result: PairingResult }>;
}

/**
 * Builds a club event's bout order by pairing rosters slot for slot.
 *
 * Because every club fills the same six slots with the same class and weight
 * profile (see `SLOT_TEMPLATE`), this always produces six legal bouts. Any
 * pairing that fails validation is reported rather than silently dropped.
 */
export function buildBoutOrder(
  playerRoster: readonly Fighter[],
  opponentRoster: readonly Fighter[],
): BoutOrderResult {
  const pairings: BoutPairing[] = [];
  const rejected: Array<{ index: number; result: PairingResult }> = [];
  const count = Math.min(playerRoster.length, opponentRoster.length);

  for (let index = 0; index < count; index += 1) {
    const player = playerRoster[index];
    const opponent = opponentRoster[index];
    if (!player || !opponent) continue;

    const result = validatePairing(player, opponent);
    if (result.legal) pairings.push({ index, player, opponent });
    else rejected.push({ index, result });
  }

  return { pairings, rejected };
}

/**
 * Chooses the deciding fighters for a 3–3 tie-breaker.
 *
 * Rule: each club nominates its highest-rated eligible competitor from the open
 * (adult and senior) division. Juniors are never nominated, which keeps the
 * decider legal without needing a separate junior tie-break.
 */
export function selectTieBreakerPair(
  playerRoster: readonly Fighter[],
  opponentRoster: readonly Fighter[],
): BoutPairing | null {
  const nominate = (roster: readonly Fighter[]): Fighter | undefined =>
    roster
      .filter((fighter) => fighter.ageClassification !== 'junior')
      .sort((a, b) => totalRating(b) - totalRating(a))[0];

  const player = nominate(playerRoster);
  const opponent = nominate(opponentRoster);
  if (!player || !opponent) return null;
  if (!validatePairing(player, opponent).legal) return null;

  // Index 6 marks the seventh, deciding bout.
  return { index: 6, player, opponent };
}

function totalRating(fighter: Fighter): number {
  const { strength, speed, defence, technique, stamina, agility } = fighter.stats;
  return strength + speed + defence + technique + stamina + agility;
}
