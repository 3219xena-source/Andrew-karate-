/**
 * Season engine.
 *
 * Builds the six-event season, applies real results, maintains the standings
 * table and resolves the championship final. Pure functions over immutable
 * state, so the whole season can be simulated and asserted in tests.
 *
 * ── Season format (also documented in `docs/SEASON_SYSTEM.md`) ───────────────
 *  • Rounds 1–5: the player's club meets each of the five rival clubs once.
 *  • Round 6:    the Tasmania Championship Final.
 *  • Points:     3 for an event win, 0 for a loss. A tie-break win is a win.
 *  • Table:      ranked by points, then bout difference, then bouts won.
 *
 * ── Championship rule ────────────────────────────────────────────────────────
 * The final is contested by the player's club — which is seeded into it as the
 * season's host club — against the highest-placed rival in the standings after
 * round 5. The table therefore decides WHO the player faces, and whether they
 * reached the final on merit (a genuine top-two finish) or as the host seed.
 * Both are reported honestly on the qualification screen.
 *
 * ── Rival fixtures ───────────────────────────────────────────────────────────
 * The player's own results are always real bouts they fought. The four rival
 * clubs not facing the player in a given round also play each other, and those
 * fixtures are resolved by a deterministic strength model rather than being
 * simulated bout by bout. This is stated in the UI wherever the table is shown.
 */

import { getRoster } from '../../data/fighters.ts';
import { TEAMS, getRivalTeams, getTeam } from '../../data/teams.ts';
import {
  POINTS_PER_EVENT_LOSS,
  POINTS_PER_EVENT_WIN,
  type EventResult,
  type SeasonEvent,
  type SeasonState,
  type StandingsRow,
} from '../../types/season.ts';
import type { TeamId } from '../../types/team.ts';

export const LEAGUE_ROUNDS = 5;
export const TOTAL_ROUNDS = 6;
export const CHAMPIONSHIP_ROUND = 6;
/** The final is always held at the championship venue. */
export const CHAMPIONSHIP_VENUE_ID = 'hobart-arena';

/** Deterministic 32-bit hash, used to vary simulated rival fixtures. */
function hash(input: string): number {
  let value = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value);
}

/** A club's aggregate strength, from its roster's authored ratings. */
export function clubStrength(teamId: TeamId): number {
  const roster = getRoster(teamId);
  if (roster.length === 0) return 0;
  const total = roster.reduce((sum, fighter) => {
    const s = fighter.stats;
    return sum + s.strength + s.speed + s.defence + s.technique + s.stamina + s.agility;
  }, 0);
  return total / roster.length;
}

/** Builds the six-event schedule for a player club. */
export function createSeason(playerTeamId: TeamId, seasonId = 'season-1'): SeasonState {
  const rivals = getRivalTeams(playerTeamId);

  const leagueEvents: SeasonEvent[] = rivals.map((rival, index) => {
    const round = index + 1;
    // Odd rounds are played at the player's home venue, even rounds away, so
    // the season visits venues across the island rather than repeating one.
    const home = round % 2 === 1;
    const host = home ? getTeam(playerTeamId) : rival;
    return {
      id: `${seasonId}-r${round}`,
      round,
      kind: 'league',
      name: `Round ${round} — ${rival.shortName}`,
      venueId: host?.venueId ?? rival.venueId,
      location: host?.location ?? rival.location,
      opponentTeamId: rival.id,
    };
  });

  const championship: SeasonEvent = {
    id: `${seasonId}-final`,
    round: CHAMPIONSHIP_ROUND,
    kind: 'championship',
    name: 'Tasmania Championship Final',
    venueId: CHAMPIONSHIP_VENUE_ID,
    location: 'Hobart',
    // Resolved from the standings once the league rounds are complete.
    opponentTeamId: null,
  };

  return {
    seasonId,
    playerTeamId,
    currentRound: 1,
    events: [...leagueEvents, championship],
    results: [],
    standings: buildStandings(playerTeamId, []),
    championshipOpponentId: null,
    seasonComplete: false,
    championshipWon: null,
  };
}

/**
 * Resolves a rival-versus-rival fixture deterministically from club strength.
 * Returns the bout score for `a`, out of six.
 */
export function simulateRivalFixture(a: TeamId, b: TeamId, seasonId: string, round: number): number {
  const strengthA = clubStrength(a);
  const strengthB = clubStrength(b);
  const edge = (strengthA - strengthB) / 12; // roughly -3..+3 bouts
  const jitter = ((hash(`${seasonId}:${round}:${a}:${b}`) % 200) / 100 - 1) * 1.4;
  const raw = 3 + edge + jitter;
  const wins = Math.max(0, Math.min(6, Math.round(raw)));
  // Six bouts cannot end 3–3 in the table model; nudge to the stronger club.
  if (wins === 3) return strengthA >= strengthB ? 4 : 2;
  return wins;
}

/** The rival-versus-rival fixtures played alongside the player's round. */
export function rivalFixturesForRound(
  playerTeamId: TeamId,
  round: number,
): ReadonlyArray<readonly [TeamId, TeamId]> {
  const rivals = getRivalTeams(playerTeamId);
  const playerOpponent = rivals[round - 1];
  if (!playerOpponent) return [];
  const others = rivals.filter((team) => team.id !== playerOpponent.id).map((team) => team.id);
  if (others.length < 4) return [];

  // Rotate the pairing each round so the same two clubs do not always meet.
  const rotation = (round - 1) % 3;
  const pairs: ReadonlyArray<readonly [number, number, number, number]> = [
    [0, 1, 2, 3],
    [0, 2, 1, 3],
    [0, 3, 1, 2],
  ];
  const order = pairs[rotation] ?? pairs[0];
  if (!order) return [];
  const [p, q, r, s] = order;
  const first = others[p];
  const second = others[q];
  const third = others[r];
  const fourth = others[s];
  if (!first || !second || !third || !fourth) return [];
  return [
    [first, second],
    [third, fourth],
  ];
}

interface Tally {
  played: number;
  eventWins: number;
  eventLosses: number;
  boutsWon: number;
  boutsLost: number;
  roundsWon: number;
  roundsLost: number;
  points: number;
}

function emptyTally(): Tally {
  return {
    played: 0,
    eventWins: 0,
    eventLosses: 0,
    boutsWon: 0,
    boutsLost: 0,
    roundsWon: 0,
    roundsLost: 0,
    points: 0,
  };
}

function award(tally: Tally, won: boolean, boutsFor: number, boutsAgainst: number): void {
  tally.played += 1;
  tally.boutsWon += boutsFor;
  tally.boutsLost += boutsAgainst;
  if (won) {
    tally.eventWins += 1;
    tally.points += POINTS_PER_EVENT_WIN;
  } else {
    tally.eventLosses += 1;
    tally.points += POINTS_PER_EVENT_LOSS;
  }
}

/**
 * Builds the standings from the player's real results plus the deterministic
 * rival fixtures for every league round that has been played.
 */
export function buildStandings(
  playerTeamId: TeamId,
  results: readonly EventResult[],
  seasonId = 'season-1',
): StandingsRow[] {
  const tallies = new Map<TeamId, Tally>(TEAMS.map((team) => [team.id, emptyTally()]));

  for (const result of results) {
    // The championship sits outside the league table.
    if (result.eventId.endsWith('-final')) continue;

    const player = tallies.get(result.playerTeamId);
    const opponent = tallies.get(result.opponentTeamId);
    if (!player || !opponent) continue;

    const playerWon = result.winner === 'player';
    award(player, playerWon, result.playerBoutWins, result.opponentBoutWins);
    award(opponent, !playerWon, result.opponentBoutWins, result.playerBoutWins);

    for (const bout of result.bouts) {
      player.roundsWon += bout.playerRounds;
      player.roundsLost += bout.opponentRounds;
      opponent.roundsWon += bout.opponentRounds;
      opponent.roundsLost += bout.playerRounds;
    }

    // The rival fixtures that ran alongside this round.
    const round = results.indexOf(result) + 1;
    for (const [a, b] of rivalFixturesForRound(playerTeamId, round)) {
      const tallyA = tallies.get(a);
      const tallyB = tallies.get(b);
      if (!tallyA || !tallyB) continue;
      const scoreA = simulateRivalFixture(a, b, seasonId, round);
      const scoreB = 6 - scoreA;
      award(tallyA, scoreA > scoreB, scoreA, scoreB);
      award(tallyB, scoreB > scoreA, scoreB, scoreA);
      // Simulated fixtures contribute bouts but not individual round detail.
    }
  }

  return TEAMS.map((team) => {
    const tally = tallies.get(team.id) ?? emptyTally();
    return { teamId: team.id, ...tally } satisfies StandingsRow;
  }).sort(compareStandings);
}

/** Points, then bout difference, then bouts won, then club name. */
function compareStandings(a: StandingsRow, b: StandingsRow): number {
  if (b.points !== a.points) return b.points - a.points;
  const diffA = a.boutsWon - a.boutsLost;
  const diffB = b.boutsWon - b.boutsLost;
  if (diffB !== diffA) return diffB - diffA;
  if (b.boutsWon !== a.boutsWon) return b.boutsWon - a.boutsWon;
  return a.teamId.localeCompare(b.teamId);
}

/** Applies a completed event result and advances the season. */
export function applyEventResult(season: SeasonState, result: EventResult): SeasonState {
  // Replacing an existing result keeps the season idempotent under a replay.
  const results = [...season.results.filter((entry) => entry.eventId !== result.eventId), result];
  const standings = buildStandings(season.playerTeamId, results, season.seasonId);

  const isChampionship = result.eventId.endsWith('-final');
  const currentRound = isChampionship
    ? TOTAL_ROUNDS + 1
    : Math.min(TOTAL_ROUNDS, season.currentRound + 1);

  const leagueComplete = results.filter((entry) => !entry.eventId.endsWith('-final')).length >= LEAGUE_ROUNDS;
  const championshipOpponentId = leagueComplete
    ? resolveChampionshipOpponent(season.playerTeamId, standings)
    : season.championshipOpponentId;

  const events = season.events.map((event) =>
    event.kind === 'championship' && championshipOpponentId
      ? { ...event, opponentTeamId: championshipOpponentId }
      : event,
  );

  return {
    ...season,
    events,
    results,
    standings,
    currentRound,
    championshipOpponentId,
    seasonComplete: isChampionship,
    championshipWon: isChampionship ? result.winner === 'player' : season.championshipWon,
  };
}

/** The highest-placed rival after the league rounds. */
export function resolveChampionshipOpponent(
  playerTeamId: TeamId,
  standings: readonly StandingsRow[],
): TeamId | null {
  const rival = standings.find((row) => row.teamId !== playerTeamId);
  return rival?.teamId ?? null;
}

/** True when the player's club earned a top-two place on merit. */
export function qualifiedOnMerit(
  playerTeamId: TeamId,
  standings: readonly StandingsRow[],
): boolean {
  const position = standings.findIndex((row) => row.teamId === playerTeamId);
  return position >= 0 && position < 2;
}

/** 1-based league position of the player's club. */
export function playerPosition(
  playerTeamId: TeamId,
  standings: readonly StandingsRow[],
): number {
  return standings.findIndex((row) => row.teamId === playerTeamId) + 1;
}

/** Availability of each event, derived from how many rounds have been played. */
export function eventStatus(
  season: SeasonState,
  event: SeasonEvent,
): 'locked' | 'available' | 'complete' {
  if (season.results.some((result) => result.eventId === event.id)) return 'complete';
  return event.round === season.currentRound ? 'available' : 'locked';
}

/** The next event to play, or null when the season is finished. */
export function nextEvent(season: SeasonState): SeasonEvent | null {
  return season.events.find((event) => eventStatus(season, event) === 'available') ?? null;
}
