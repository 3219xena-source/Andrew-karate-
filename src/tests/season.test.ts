/**
 * Matchmaking safety, club events and the season.
 *
 * The most important assertions here are the safety ones: no bout in this game
 * can pair a junior competitor against an adult or senior, and every scheduled
 * pairing in every possible fixture is checked.
 */

import { describe, expect, it } from 'vitest';
import { FIGHTERS, SLOT_TEMPLATE, getFighter, getRoster } from '../data/fighters.ts';
import { TEAMS } from '../data/teams.ts';
import { VENUES, getVenue } from '../data/venues.ts';
import {
  buildBoutOrder,
  selectTieBreakerPair,
  validatePairing,
} from '../systems/match/matchmaking.ts';
import { BOUTS_PER_EVENT, EventController } from '../systems/season/eventController.ts';
import {
  applyEventResult,
  buildStandings,
  createSeason,
  eventStatus,
  nextEvent,
  playerPosition,
  qualifiedOnMerit,
} from '../systems/season/seasonEngine.ts';
import { EMPTY_BOUT_STATS, type BoutResult } from '../types/season.ts';
import type { TeamId } from '../types/team.ts';

// ── Helpers ──────────────────────────────────────────────────────────────────

function bout(index: number, winner: 'player' | 'opponent', ids: [string, string], tie = false): BoutResult {
  return {
    index,
    playerFighterId: ids[0],
    opponentFighterId: ids[1],
    winner,
    playerRounds: winner === 'player' ? 2 : 1,
    opponentRounds: winner === 'player' ? 1 : 2,
    endReason: 'knockout',
    stats: EMPTY_BOUT_STATS,
    isTieBreaker: tie,
  };
}

function controllerFor(player: TeamId, opponent: TeamId): EventController {
  return new EventController({
    eventId: 'test-event',
    playerTeamId: player,
    opponentTeamId: opponent,
    playerRoster: getRoster(player),
    opponentRoster: getRoster(opponent),
  });
}

/** Plays out an event with a scripted sequence of winners. */
function playEvent(
  controller: EventController,
  winners: ReadonlyArray<'player' | 'opponent'>,
): void {
  for (const winner of winners) {
    const pairing = controller.getNextPairing();
    if (!pairing) break;
    controller.recordBout(
      bout(pairing.index, winner, [pairing.player.id, pairing.opponent.id], pairing.index >= 6),
    );
  }
}

// ── Matchmaking safety ───────────────────────────────────────────────────────

describe('matchmaking safety', () => {
  it('never allows a junior to be matched against an adult or senior', () => {
    const juniors = FIGHTERS.filter((fighter) => fighter.ageClassification === 'junior');
    const open = FIGHTERS.filter((fighter) => fighter.ageClassification !== 'junior');
    expect(juniors.length).toBeGreaterThan(0);
    expect(open.length).toBeGreaterThan(0);

    for (const junior of juniors) {
      for (const adult of open) {
        const result = validatePairing(junior, adult);
        expect(result.legal, `${junior.name} vs ${adult.name}`).toBe(false);
        expect(result.reason).toBe('junior-versus-open');
        // The refusal must be explained, not silent.
        expect(result.message).toBeTruthy();
      }
    }
  });

  it('allows juniors to face other juniors', () => {
    const juniors = FIGHTERS.filter((fighter) => fighter.ageClassification === 'junior');
    for (const a of juniors) {
      for (const b of juniors) {
        if (a.id === b.id) continue;
        expect(validatePairing(a, b).legal, `${a.name} vs ${b.name}`).toBe(true);
      }
    }
  });

  it('refuses to match a fighter against themselves', () => {
    const andrew = getFighter('andrew-gillian');
    expect(andrew).toBeDefined();
    const result = validatePairing(andrew!, andrew!);
    expect(result.legal).toBe(false);
    expect(result.reason).toBe('same-fighter');
  });

  it('produces six legal bouts for every possible club fixture', () => {
    for (const home of TEAMS) {
      for (const away of TEAMS) {
        if (home.id === away.id) continue;
        const order = buildBoutOrder(getRoster(home.id), getRoster(away.id));
        expect(order.pairings, `${home.id} vs ${away.id}`).toHaveLength(BOUTS_PER_EVENT);
        expect(order.rejected, `${home.id} vs ${away.id}`).toHaveLength(0);
        for (const pairing of order.pairings) {
          expect(pairing.player.ageClassification).toBe(pairing.opponent.ageClassification);
        }
      }
    }
  });

  it('gives every club the same slot profile, which is what makes that safe', () => {
    for (const team of TEAMS) {
      const roster = getRoster(team.id);
      roster.forEach((fighter, index) => {
        const template = SLOT_TEMPLATE[index];
        expect(fighter.slot).toBe(index);
        expect(fighter.ageClassification).toBe(template?.ageClassification);
        expect(fighter.weightClass).toBe(template?.weightClass);
      });
    }
  });

  it('never nominates a junior for the tie-breaker', () => {
    for (const home of TEAMS) {
      for (const away of TEAMS) {
        if (home.id === away.id) continue;
        const pair = selectTieBreakerPair(getRoster(home.id), getRoster(away.id));
        expect(pair).not.toBeNull();
        expect(pair?.player.ageClassification).not.toBe('junior');
        expect(pair?.opponent.ageClassification).not.toBe('junior');
        expect(validatePairing(pair!.player, pair!.opponent).legal).toBe(true);
      }
    }
  });
});

// ── Venues ───────────────────────────────────────────────────────────────────

describe('venues', () => {
  it('provides a venue for every club', () => {
    expect(VENUES).toHaveLength(6);
    for (const team of TEAMS) {
      const venue = getVenue(team.venueId);
      expect(venue, team.id).toBeDefined();
      expect(venue?.homeTeamId).toBe(team.id);
      expect(venue?.name.length).toBeGreaterThan(0);
      expect(venue?.description.length).toBeGreaterThan(20);
      expect(venue?.capacity).toBeGreaterThan(0);
    }
  });

  it('gives every venue a distinct visual motif and palette', () => {
    const motifs = new Set(VENUES.map((venue) => venue.motif));
    expect(motifs.size).toBe(VENUES.length);
    for (const venue of VENUES) {
      expect(venue.palette.matPrimary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(venue.palette.crowd).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

// ── Club events ──────────────────────────────────────────────────────────────

describe('club events', () => {
  it('schedules six sequential bouts, paired slot for slot', () => {
    const controller = controllerFor('hobart', 'burnie');
    const pairings = controller.getPairings();
    expect(pairings).toHaveLength(6);
    pairings.forEach((pairing, index) => {
      expect(pairing.index).toBe(index);
      expect(pairing.player.slot).toBe(index);
      expect(pairing.opponent.slot).toBe(index);
    });
  });

  it('advances to the next fighter after each bout', () => {
    const controller = controllerFor('hobart', 'burnie');
    const first = controller.getNextPairing();
    expect(first?.index).toBe(0);
    controller.recordBout(bout(0, 'player', [first!.player.id, first!.opponent.id]));
    expect(controller.getNextPairing()?.index).toBe(1);
    expect(controller.getCompletedBouts()).toHaveLength(1);
  });

  it('tracks the running club score', () => {
    const controller = controllerFor('hobart', 'burnie');
    playEvent(controller, ['player', 'opponent', 'player']);
    expect(controller.getPlayerScore()).toBe(2);
    expect(controller.getOpponentScore()).toBe(1);
    expect(controller.isComplete()).toBe(false);
  });

  it('decides a 4–2 event', () => {
    const controller = controllerFor('hobart', 'burnie');
    playEvent(controller, ['player', 'player', 'opponent', 'opponent', 'player', 'player']);
    expect(controller.isComplete()).toBe(true);
    const result = controller.getResult();
    expect(result?.playerBoutWins).toBe(4);
    expect(result?.opponentBoutWins).toBe(2);
    expect(result?.winner).toBe('player');
    expect(result?.decidedByTieBreaker).toBe(false);
  });

  it('decides a 5–1 event', () => {
    const controller = controllerFor('hobart', 'devonport');
    playEvent(controller, ['player', 'player', 'opponent', 'player', 'player', 'player']);
    const result = controller.getResult();
    expect(result?.playerBoutWins).toBe(5);
    expect(result?.opponentBoutWins).toBe(1);
    expect(result?.winner).toBe('player');
  });

  it('decides a 6–0 event', () => {
    const controller = controllerFor('hobart', 'smithton');
    playEvent(controller, Array<'player'>(6).fill('player'));
    const result = controller.getResult();
    expect(result?.playerBoutWins).toBe(6);
    expect(result?.opponentBoutWins).toBe(0);
  });

  it('contests all six bouts even after the tie is mathematically won', () => {
    const controller = controllerFor('hobart', 'burnie');
    playEvent(controller, ['player', 'player', 'player', 'player']);
    // Four wins settles the outcome, but the fifth and sixth are still fought.
    expect(controller.isComplete()).toBe(false);
    expect(controller.getNextPairing()?.index).toBe(4);

    playEvent(controller, ['opponent', 'opponent']);
    expect(controller.isComplete()).toBe(true);
    expect(controller.getCompletedBouts()).toHaveLength(6);
    expect(controller.getResult()?.winner).toBe('player');
  });

  it('recognises a 3–3 tie and schedules a deciding seventh bout', () => {
    const controller = controllerFor('hobart', 'burnie');
    playEvent(controller, ['player', 'opponent', 'player', 'opponent', 'player', 'opponent']);

    expect(controller.getPlayerScore()).toBe(3);
    expect(controller.getOpponentScore()).toBe(3);
    expect(controller.needsTieBreaker()).toBe(true);
    expect(controller.isComplete()).toBe(false);

    const decider = controller.getNextPairing();
    expect(decider).not.toBeNull();
    expect(decider?.index).toBe(6);
    expect(decider?.player.ageClassification).not.toBe('junior');
  });

  it('never leaves a 3–3 event without a result', () => {
    const controller = controllerFor('hobart', 'burnie');
    playEvent(controller, ['player', 'opponent', 'player', 'opponent', 'player', 'opponent']);
    const decider = controller.getNextPairing();
    controller.recordBout(
      bout(6, 'player', [decider!.player.id, decider!.opponent.id], true),
    );

    expect(controller.isComplete()).toBe(true);
    const result = controller.getResult();
    expect(result?.winner).toBe('player');
    expect(result?.playerBoutWins).toBe(4);
    expect(result?.decidedByTieBreaker).toBe(true);
  });

  it('ignores a duplicate bout result', () => {
    const controller = controllerFor('hobart', 'burnie');
    const pairing = controller.getNextPairing()!;
    const record = bout(0, 'player', [pairing.player.id, pairing.opponent.id]);
    controller.recordBout(record);
    controller.recordBout(record);
    expect(controller.getCompletedBouts()).toHaveLength(1);
  });

  it('resumes from previously completed bouts', () => {
    const first = controllerFor('hobart', 'burnie');
    playEvent(first, ['player', 'opponent']);

    const resumed = new EventController({
      eventId: 'test-event',
      playerTeamId: 'hobart',
      opponentTeamId: 'burnie',
      playerRoster: getRoster('hobart'),
      opponentRoster: getRoster('burnie'),
      completedBouts: first.getCompletedBouts(),
    });

    expect(resumed.getPlayerScore()).toBe(1);
    expect(resumed.getOpponentScore()).toBe(1);
    expect(resumed.getNextPairing()?.index).toBe(2);
  });

  it('reports no result while the event is unfinished', () => {
    const controller = controllerFor('hobart', 'burnie');
    playEvent(controller, ['player']);
    expect(controller.getResult()).toBeNull();
  });
});

// ── Season ───────────────────────────────────────────────────────────────────

describe('season', () => {
  it('builds six events: five league rounds and a championship final', () => {
    const season = createSeason('hobart');
    expect(season.events).toHaveLength(6);
    expect(season.events.filter((event) => event.kind === 'league')).toHaveLength(5);
    expect(season.events.filter((event) => event.kind === 'championship')).toHaveLength(1);
    expect(season.events.map((event) => event.round)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('schedules the player against each rival exactly once', () => {
    const season = createSeason('devonport');
    const opponents = season.events
      .filter((event) => event.kind === 'league')
      .map((event) => event.opponentTeamId);
    expect(new Set(opponents).size).toBe(5);
    expect(opponents).not.toContain('devonport');
  });

  it('works for every club as the player club', () => {
    for (const team of TEAMS) {
      const season = createSeason(team.id);
      expect(season.playerTeamId).toBe(team.id);
      expect(season.events).toHaveLength(6);
      for (const event of season.events) {
        if (event.kind === 'league') expect(event.opponentTeamId).not.toBe(team.id);
        expect(getVenue(event.venueId), `${team.id} round ${event.round}`).toBeDefined();
      }
    }
  });

  it('unlocks events strictly in order', () => {
    const season = createSeason('hobart');
    const statuses = season.events.map((event) => eventStatus(season, event));
    expect(statuses[0]).toBe('available');
    expect(statuses.slice(1).every((status) => status === 'locked')).toBe(true);
    expect(nextEvent(season)?.round).toBe(1);
  });

  it('advances the season as results are applied', () => {
    let season = createSeason('hobart');
    const controller = controllerFor('hobart', season.events[0]!.opponentTeamId!);
    playEvent(controller, ['player', 'player', 'player', 'player', 'player', 'player']);

    season = applyEventResult(season, { ...controller.getResult()!, eventId: season.events[0]!.id });
    expect(season.currentRound).toBe(2);
    expect(eventStatus(season, season.events[0]!)).toBe('complete');
    expect(eventStatus(season, season.events[1]!)).toBe('available');
  });

  it('awards three points for a win and none for a loss', () => {
    let season = createSeason('hobart');
    const first = season.events[0]!;
    const controller = controllerFor('hobart', first.opponentTeamId!);
    playEvent(controller, ['player', 'player', 'player', 'player', 'player', 'player']);
    season = applyEventResult(season, { ...controller.getResult()!, eventId: first.id });

    const row = season.standings.find((entry) => entry.teamId === 'hobart');
    expect(row?.points).toBe(3);
    expect(row?.eventWins).toBe(1);
    expect(row?.eventLosses).toBe(0);

    const beaten = season.standings.find((entry) => entry.teamId === first.opponentTeamId);
    expect(beaten?.points).toBe(0);
    expect(beaten?.eventLosses).toBe(1);
  });

  it('ranks every club in the table after each round', () => {
    let season = createSeason('hobart');
    for (let round = 0; round < 5; round += 1) {
      const event = season.events[round]!;
      const controller = controllerFor('hobart', event.opponentTeamId!);
      playEvent(controller, ['player', 'player', 'player', 'player', 'player', 'player']);
      season = applyEventResult(season, { ...controller.getResult()!, eventId: event.id });
    }

    expect(season.standings).toHaveLength(6);
    expect(season.standings.every((row) => row.played > 0)).toBe(true);
    // A club that won all five must lead the table.
    expect(season.standings[0]?.teamId).toBe('hobart');
    expect(playerPosition('hobart', season.standings)).toBe(1);
    expect(qualifiedOnMerit('hobart', season.standings)).toBe(true);
  });

  it('resolves the championship opponent from the real standings', () => {
    let season = createSeason('hobart');
    for (let round = 0; round < 5; round += 1) {
      const event = season.events[round]!;
      const controller = controllerFor('hobart', event.opponentTeamId!);
      playEvent(controller, ['player', 'player', 'player', 'player', 'player', 'player']);
      season = applyEventResult(season, { ...controller.getResult()!, eventId: event.id });
    }

    expect(season.championshipOpponentId).not.toBeNull();
    expect(season.championshipOpponentId).not.toBe('hobart');
    const final = season.events.find((event) => event.kind === 'championship');
    expect(final?.opponentTeamId).toBe(season.championshipOpponentId);
    expect(eventStatus(season, final!)).toBe('available');
  });

  it('completes the season when the final is played', () => {
    let season = createSeason('hobart');
    for (let round = 0; round < 5; round += 1) {
      const event = season.events[round]!;
      const controller = controllerFor('hobart', event.opponentTeamId!);
      playEvent(controller, ['player', 'player', 'player', 'player', 'player', 'player']);
      season = applyEventResult(season, { ...controller.getResult()!, eventId: event.id });
    }

    const final = season.events.find((event) => event.kind === 'championship')!;
    const finalController = controllerFor('hobart', season.championshipOpponentId!);
    playEvent(finalController, ['player', 'player', 'player', 'player', 'player', 'player']);
    season = applyEventResult(season, { ...finalController.getResult()!, eventId: final.id });

    expect(season.seasonComplete).toBe(true);
    expect(season.championshipWon).toBe(true);
  });

  it('records a lost final honestly', () => {
    let season = createSeason('rosebery');
    for (let round = 0; round < 5; round += 1) {
      const event = season.events[round]!;
      const controller = controllerFor('rosebery', event.opponentTeamId!);
      playEvent(controller, ['opponent', 'opponent', 'opponent', 'opponent', 'opponent', 'opponent']);
      season = applyEventResult(season, { ...controller.getResult()!, eventId: event.id });
    }

    const final = season.events.find((event) => event.kind === 'championship')!;
    const finalController = controllerFor('rosebery', season.championshipOpponentId!);
    playEvent(finalController, ['opponent', 'opponent', 'opponent', 'opponent', 'opponent', 'opponent']);
    season = applyEventResult(season, { ...finalController.getResult()!, eventId: final.id });

    expect(season.seasonComplete).toBe(true);
    expect(season.championshipWon).toBe(false);
    // A club that lost every tie must not be top of the table.
    expect(qualifiedOnMerit('rosebery', season.standings)).toBe(false);
  });

  it('keeps the championship outside the league table', () => {
    let season = createSeason('hobart');
    for (let round = 0; round < 5; round += 1) {
      const event = season.events[round]!;
      const controller = controllerFor('hobart', event.opponentTeamId!);
      playEvent(controller, ['player', 'player', 'player', 'player', 'player', 'player']);
      season = applyEventResult(season, { ...controller.getResult()!, eventId: event.id });
    }
    const playedBefore = season.standings.find((row) => row.teamId === 'hobart')?.played;

    const final = season.events.find((event) => event.kind === 'championship')!;
    const finalController = controllerFor('hobart', season.championshipOpponentId!);
    playEvent(finalController, ['player', 'player', 'player', 'player', 'player', 'player']);
    season = applyEventResult(season, { ...finalController.getResult()!, eventId: final.id });

    expect(season.standings.find((row) => row.teamId === 'hobart')?.played).toBe(playedBefore);
  });

  it('builds an empty but complete table before any results', () => {
    const standings = buildStandings('hobart', []);
    expect(standings).toHaveLength(6);
    expect(standings.every((row) => row.played === 0 && row.points === 0)).toBe(true);
  });
});
