/**
 * Save version 1 → 2 migration and season persistence.
 *
 * The load path is deliberately paranoid: a season is never trusted from disk.
 * Only the event results are read, and the schedule, the standings and the
 * championship outcome are all recomputed from them — so a hand-edited table or
 * an invented championship flag has no effect.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRoster } from '../data/fighters.ts';
import { loadSave, sanitiseSeason, writeSave } from '../systems/save/saveManager.ts';
import { migrateSave } from '../systems/save/migrations.ts';
import { EventController } from '../systems/season/eventController.ts';
import { applyEventResult, createSeason } from '../systems/season/seasonEngine.ts';
import { EMPTY_BOUT_STATS, type BoutResult, type SeasonState } from '../types/season.ts';
import { SAVE_STORAGE_KEY, SAVE_VERSION, createDefaultSave } from '../types/save.ts';
import type { TeamId } from '../types/team.ts';

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

/** A realistic Stage 1 save, exactly as version 1 wrote it. */
function stage1Save(): Record<string, unknown> {
  return {
    version: 1,
    audio: {
      masterEnabled: false,
      musicEnabled: true,
      sfxEnabled: true,
      musicVolume: 0.25,
      sfxVolume: 0.8,
    },
    accessibility: { reducedMotion: true },
    progress: {
      selectedTeamId: 'burnie',
      selectedFighterId: 'bram-hollis',
      completedObjectiveIds: ['reach-mark', 'footwork', 'jump'],
      tutorialComplete: false,
      stage1Complete: false,
      firstTournamentUnlocked: false,
    },
  };
}

function bout(index: number, winner: 'player' | 'opponent', ids: [string, string]): BoutResult {
  return {
    index,
    playerFighterId: ids[0],
    opponentFighterId: ids[1],
    winner,
    playerRounds: winner === 'player' ? 2 : 0,
    opponentRounds: winner === 'player' ? 0 : 2,
    endReason: 'knockout',
    stats: EMPTY_BOUT_STATS,
    isTieBreaker: false,
  };
}

/** Plays a full league round for `player`, with a scripted result. */
function playRound(
  season: SeasonState,
  round: number,
  winners: ReadonlyArray<'player' | 'opponent'>,
): SeasonState {
  const event = season.events[round - 1];
  if (!event?.opponentTeamId) throw new Error(`round ${round} has no opponent`);
  const controller = new EventController({
    eventId: event.id,
    playerTeamId: season.playerTeamId,
    opponentTeamId: event.opponentTeamId,
    playerRoster: getRoster(season.playerTeamId),
    opponentRoster: getRoster(event.opponentTeamId),
  });
  for (const winner of winners) {
    const pairing = controller.getNextPairing();
    if (!pairing) break;
    controller.recordBout(bout(pairing.index, winner, [pairing.player.id, pairing.opponent.id]));
  }
  return applyEventResult(season, controller.getResult()!);
}

const SWEEP: ReadonlyArray<'player'> = ['player', 'player', 'player', 'player', 'player', 'player'];

describe('version 1 to 2 migration', () => {
  it('upgrades the version and adds every Stage 2 field', () => {
    const migrated = migrateSave(stage1Save(), 1);
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated).toHaveProperty('playerTeamId');
    expect(migrated).toHaveProperty('difficulty');
    expect(migrated).toHaveProperty('season');
    expect(migrated).toHaveProperty('fighterRecords');
    expect(migrated).toHaveProperty('activeEvent');
  });

  it('keeps every Stage 1 setting and all training progress', () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(stage1Save()));
    const result = loadSave();

    expect(result.status).toBe('migrated');
    expect(result.detail).toContain('upgraded');
    expect(result.data.audio.masterEnabled).toBe(false);
    expect(result.data.audio.musicVolume).toBe(0.25);
    expect(result.data.accessibility.reducedMotion).toBe(true);
    expect(result.data.progress.completedObjectiveIds).toEqual([
      'reach-mark',
      'footwork',
      'jump',
    ]);
    expect(result.data.progress.selectedFighterId).toBe('bram-hollis');
  });

  it('promotes the Stage 1 club to the Stage 2 season club', () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(stage1Save()));
    const result = loadSave();
    expect(result.data.playerTeamId).toBe('burnie');
    // No season existed in Stage 1, so the player starts a fresh one.
    expect(result.data.season).toBeNull();
  });

  it('defaults the accessibility fields introduced in version 2', () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(stage1Save()));
    const result = loadSave();
    expect(result.data.accessibility.screenShake).toBe(true);
    expect(result.data.accessibility.announcementCaptions).toBe(true);
    expect(result.data.difficulty).toBe('standard');
  });

  it('migrates a Stage 1 save that never chose a club', () => {
    const save = stage1Save();
    save.progress = { ...(save.progress as object), selectedTeamId: null, selectedFighterId: null };
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
    const result = loadSave();
    expect(result.status).toBe('migrated');
    expect(result.data.playerTeamId).toBeNull();
  });
});

describe('season persistence', () => {
  it('round-trips a part-played season through storage', () => {
    let season = createSeason('hobart');
    season = playRound(season, 1, SWEEP);
    // A 4–2 loss; a 3–3 script would need a decider before it produced a result.
    season = playRound(season, 2, ['opponent', 'opponent', 'opponent', 'opponent', 'player', 'player']);

    const save = { ...createDefaultSave(), playerTeamId: 'hobart' as TeamId, season };
    expect(writeSave(save)).toBe(true);

    const loaded = loadSave();
    expect(loaded.status).toBe('loaded');
    expect(loaded.data.season?.results).toHaveLength(2);
    expect(loaded.data.season?.currentRound).toBe(3);
    expect(loaded.data.season?.results[0]?.winner).toBe('player');
    expect(loaded.data.season?.results[1]?.winner).toBe('opponent');
  });

  it('keeps the standings consistent with the saved results', () => {
    let season = createSeason('devonport');
    season = playRound(season, 1, SWEEP);
    season = playRound(season, 2, SWEEP);

    const loaded = sanitiseSeason({ ...season });
    const row = loaded?.standings.find((entry) => entry.teamId === 'devonport');
    expect(row?.played).toBe(2);
    expect(row?.points).toBe(6);
    expect(row?.boutsWon).toBe(12);
  });

  it('recomputes the standings rather than trusting them from disk', () => {
    let season = createSeason('hobart');
    season = playRound(season, 1, SWEEP);

    // A hand-edited save awarding a rival an unearned 99 points.
    const tampered = {
      ...season,
      standings: season.standings.map((row) =>
        row.teamId === 'burnie' ? { ...row, points: 99, eventWins: 33 } : row,
      ),
    };

    const loaded = sanitiseSeason(tampered);
    const burnie = loaded?.standings.find((row) => row.teamId === 'burnie');
    expect(burnie?.points).toBeLessThan(99);
    expect(burnie?.eventWins).toBeLessThan(33);
  });

  it('refuses an invented championship result', () => {
    const season = createSeason('hobart');
    // No events played at all, but the save claims the championship was won.
    const tampered = { ...season, seasonComplete: true, championshipWon: true };
    const loaded = sanitiseSeason(tampered);
    expect(loaded?.seasonComplete).toBe(false);
    expect(loaded?.championshipWon).toBeNull();
  });

  it('drops bouts that name a fighter who no longer exists', () => {
    let season = createSeason('hobart');
    season = playRound(season, 1, SWEEP);

    const corrupted = {
      ...season,
      results: season.results.map((result) => ({
        ...result,
        bouts: result.bouts.map((entry, index) =>
          index === 0 ? { ...entry, playerFighterId: 'someone-who-left' } : entry,
        ),
      })),
    };

    const loaded = sanitiseSeason(corrupted);
    // The bad bout is dropped; the rest of the event survives.
    expect(loaded?.results[0]?.bouts).toHaveLength(5);
    expect(loaded?.results[0]?.playerBoutWins).toBe(5);
  });

  it('rejects a season naming an unknown club', () => {
    expect(sanitiseSeason({ playerTeamId: 'atlantis', results: [] })).toBeNull();
    expect(sanitiseSeason(null)).toBeNull();
    expect(sanitiseSeason('not a season')).toBeNull();
  });

  it('rebuilds a valid empty season from a header with no results', () => {
    const loaded = sanitiseSeason({ playerTeamId: 'smithton', seasonId: 'season-1', results: [] });
    expect(loaded?.playerTeamId).toBe('smithton');
    expect(loaded?.events).toHaveLength(6);
    expect(loaded?.currentRound).toBe(1);
  });

  it('restores a completed season, including a lost final', () => {
    let season = createSeason('rosebery');
    for (let round = 1; round <= 5; round += 1) {
      season = playRound(season, round, SWEEP);
    }
    const final = season.events.find((event) => event.kind === 'championship')!;
    const controller = new EventController({
      eventId: final.id,
      playerTeamId: 'rosebery',
      opponentTeamId: season.championshipOpponentId!,
      playerRoster: getRoster('rosebery'),
      opponentRoster: getRoster(season.championshipOpponentId!),
    });
    for (let i = 0; i < 6; i += 1) {
      const pairing = controller.getNextPairing()!;
      controller.recordBout(bout(pairing.index, 'opponent', [pairing.player.id, pairing.opponent.id]));
    }
    season = applyEventResult(season, controller.getResult()!);

    const loaded = sanitiseSeason(season);
    expect(loaded?.seasonComplete).toBe(true);
    expect(loaded?.championshipWon).toBe(false);
    expect(loaded?.currentRound).toBe(7);
  });

  it('keeps completed bouts from an event that is still in progress', () => {
    const save = {
      ...createDefaultSave(),
      playerTeamId: 'hobart' as TeamId,
      season: createSeason('hobart'),
      activeEvent: {
        eventId: 'season-1-r1',
        bouts: [bout(0, 'player', ['andrew-gillian', 'rowan-delacourt'])],
      },
    };
    expect(writeSave(save)).toBe(true);

    const loaded = loadSave();
    expect(loaded.data.activeEvent?.eventId).toBe('season-1-r1');
    expect(loaded.data.activeEvent?.bouts).toHaveLength(1);
  });

  it('drops fighter records for fighters that no longer exist', () => {
    const save = {
      ...createDefaultSave(),
      fighterRecords: {
        'andrew-gillian': { wins: 3, losses: 1, knockouts: 2 },
        'a-fighter-who-left': { wins: 9, losses: 0, knockouts: 9 },
      },
    };
    expect(writeSave(save)).toBe(true);

    const loaded = loadSave();
    expect(loaded.data.fighterRecords['andrew-gillian']).toEqual({
      wins: 3,
      losses: 1,
      knockouts: 2,
    });
    expect(loaded.data.fighterRecords['a-fighter-who-left']).toBeUndefined();
  });
});
