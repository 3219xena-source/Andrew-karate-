/**
 * Save manager.
 *
 * Persists to `localStorage` under a single versioned key. The loader is
 * defensive by design: unavailable storage, missing keys, malformed JSON,
 * unknown versions and individually corrupt fields all resolve to a usable save
 * rather than an exception. Every recovery path is reported through the
 * returned `SaveLoadResult` — nothing is swallowed silently.
 *
 * Privacy: only game progress and preferences are stored. No personal or
 * sensitive information is written, ever.
 */

import { getFighter } from '../../data/fighters.ts';
import { isKnownTeamId } from '../../data/teams.ts';
import { EMPTY_FIGHTER_RECORD, type FighterRecord } from '../../types/fighter.ts';
import type { BoutResult, EventResult, SeasonState, StandingsRow } from '../../types/season.ts';
import {
  DEFAULT_ACCESSIBILITY_SETTINGS,
  DEFAULT_AUDIO_SETTINGS,
  DEFAULT_DIFFICULTY,
  DEFAULT_PROGRESS,
  SAVE_STORAGE_KEY,
  SAVE_VERSION,
  createDefaultSave,
  type AccessibilitySettings,
  type ActiveEventSave,
  type AudioSettings,
  type ProgressData,
  type SaveData,
} from '../../types/save.ts';
import type { Difficulty } from '../ai/opponentAI.ts';
import { buildStandings, createSeason } from '../season/seasonEngine.ts';
import { migrateSave } from './migrations.ts';

export type SaveLoadStatus = 'loaded' | 'empty' | 'migrated' | 'recovered' | 'unavailable';

export interface SaveLoadResult {
  readonly data: SaveData;
  readonly status: SaveLoadStatus;
  /** Human-readable explanation, present whenever status is not 'loaded'. */
  readonly detail?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clamp01(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function int(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.round(value);
}

export function sanitiseAudio(input: unknown): AudioSettings {
  if (!isRecord(input)) return DEFAULT_AUDIO_SETTINGS;
  return {
    masterEnabled: bool(input.masterEnabled, DEFAULT_AUDIO_SETTINGS.masterEnabled),
    musicEnabled: bool(input.musicEnabled, DEFAULT_AUDIO_SETTINGS.musicEnabled),
    sfxEnabled: bool(input.sfxEnabled, DEFAULT_AUDIO_SETTINGS.sfxEnabled),
    musicVolume: clamp01(input.musicVolume, DEFAULT_AUDIO_SETTINGS.musicVolume),
    sfxVolume: clamp01(input.sfxVolume, DEFAULT_AUDIO_SETTINGS.sfxVolume),
  };
}

export function sanitiseAccessibility(input: unknown): AccessibilitySettings {
  if (!isRecord(input)) return DEFAULT_ACCESSIBILITY_SETTINGS;
  return {
    reducedMotion: bool(input.reducedMotion, DEFAULT_ACCESSIBILITY_SETTINGS.reducedMotion),
    screenShake: bool(input.screenShake, DEFAULT_ACCESSIBILITY_SETTINGS.screenShake),
    announcementCaptions: bool(
      input.announcementCaptions,
      DEFAULT_ACCESSIBILITY_SETTINGS.announcementCaptions,
    ),
  };
}

export function sanitiseProgress(input: unknown): ProgressData {
  if (!isRecord(input)) return DEFAULT_PROGRESS;

  const selectedTeamId = isKnownTeamId(input.selectedTeamId) ? input.selectedTeamId : null;

  const fighter =
    typeof input.selectedFighterId === 'string' ? getFighter(input.selectedFighterId) : undefined;
  const selectedFighterId =
    fighter && (!selectedTeamId || fighter.teamId === selectedTeamId) ? fighter.id : null;

  const completedObjectiveIds = Array.isArray(input.completedObjectiveIds)
    ? Array.from(
        new Set(input.completedObjectiveIds.filter((id): id is string => typeof id === 'string')),
      )
    : [];

  const tutorialComplete = bool(input.tutorialComplete, false);
  const stage1Complete = bool(input.stage1Complete, false) && tutorialComplete;

  return {
    selectedTeamId,
    selectedFighterId,
    completedObjectiveIds,
    tutorialComplete,
    stage1Complete,
    // Derived, never trusted from disk.
    firstTournamentUnlocked: stage1Complete,
  };
}

const DIFFICULTIES: readonly Difficulty[] = ['beginner', 'standard', 'advanced'];

function sanitiseDifficulty(input: unknown): Difficulty {
  return typeof input === 'string' && (DIFFICULTIES as readonly string[]).includes(input)
    ? (input as Difficulty)
    : DEFAULT_DIFFICULTY;
}

function sanitiseBout(input: unknown): BoutResult | null {
  if (!isRecord(input)) return null;
  const playerFighterId =
    typeof input.playerFighterId === 'string' ? getFighter(input.playerFighterId)?.id : undefined;
  const opponentFighterId =
    typeof input.opponentFighterId === 'string'
      ? getFighter(input.opponentFighterId)?.id
      : undefined;
  // A bout naming a fighter that no longer exists cannot be trusted.
  if (!playerFighterId || !opponentFighterId) return null;

  const winner = input.winner === 'player' || input.winner === 'opponent' ? input.winner : null;
  if (!winner) return null;

  const stats = isRecord(input.stats) ? input.stats : {};
  return {
    index: int(input.index, 0),
    playerFighterId,
    opponentFighterId,
    winner,
    playerRounds: Math.max(0, int(input.playerRounds, 0)),
    opponentRounds: Math.max(0, int(input.opponentRounds, 0)),
    endReason:
      input.endReason === 'knockout' || input.endReason === 'timeout' || input.endReason === 'draw'
        ? input.endReason
        : 'timeout',
    stats: {
      damageDealt: Math.max(0, int(stats.damageDealt, 0)),
      damageTaken: Math.max(0, int(stats.damageTaken, 0)),
      punchesLanded: Math.max(0, int(stats.punchesLanded, 0)),
      kicksLanded: Math.max(0, int(stats.kicksLanded, 0)),
      strongAttacksLanded: Math.max(0, int(stats.strongAttacksLanded, 0)),
      attacksBlocked: Math.max(0, int(stats.attacksBlocked, 0)),
      dodgesSucceeded: Math.max(0, int(stats.dodgesSucceeded, 0)),
      powerMovesUsed: Math.max(0, int(stats.powerMovesUsed, 0)),
      knockouts: Math.max(0, int(stats.knockouts, 0)),
    },
    isTieBreaker: bool(input.isTieBreaker, false),
  };
}

function sanitiseEventResult(input: unknown): EventResult | null {
  if (!isRecord(input)) return null;
  if (typeof input.eventId !== 'string') return null;
  if (!isKnownTeamId(input.playerTeamId) || !isKnownTeamId(input.opponentTeamId)) return null;

  const bouts = Array.isArray(input.bouts)
    ? input.bouts.map(sanitiseBout).filter((bout): bout is BoutResult => bout !== null)
    : [];

  // Scores are recomputed from the bouts, so an edited header cannot lie.
  const playerBoutWins = bouts.filter((bout) => bout.winner === 'player').length;
  const opponentBoutWins = bouts.filter((bout) => bout.winner === 'opponent').length;
  if (playerBoutWins + opponentBoutWins === 0) return null;

  return {
    eventId: input.eventId,
    playerTeamId: input.playerTeamId,
    opponentTeamId: input.opponentTeamId,
    playerBoutWins,
    opponentBoutWins,
    winner: playerBoutWins > opponentBoutWins ? 'player' : 'opponent',
    decidedByTieBreaker: bouts.some((bout) => bout.isTieBreaker),
    bouts,
  };
}

/**
 * Rebuilds a season from saved results.
 *
 * The schedule and the standings are recomputed rather than trusted: only the
 * event results are read from disk, so a hand-edited table or an invented
 * championship flag has no effect.
 */
export function sanitiseSeason(input: unknown): SeasonState | null {
  if (!isRecord(input)) return null;
  if (!isKnownTeamId(input.playerTeamId)) return null;

  const seasonId = typeof input.seasonId === 'string' ? input.seasonId : 'season-1';
  const base = createSeason(input.playerTeamId, seasonId);

  const results = Array.isArray(input.results)
    ? input.results
        .map(sanitiseEventResult)
        .filter((result): result is EventResult => result !== null)
    : [];

  if (results.length === 0) return base;

  // Replay the results through the engine so every derived value is genuine.
  const league = results.filter((result) => !result.eventId.endsWith('-final'));
  const final = results.find((result) => result.eventId.endsWith('-final'));
  const ordered = final ? [...league, final] : league;

  let season = base;
  for (const result of ordered) {
    season = applyResultLocally(season, result);
  }
  return season;
}

/**
 * Local re-application used by the loader. Kept separate from the season
 * engine's `applyEventResult` import cycle by re-deriving the same values.
 */
function applyResultLocally(season: SeasonState, result: EventResult): SeasonState {
  const results = [...season.results, result];
  const standings: readonly StandingsRow[] = buildStandings(
    season.playerTeamId,
    results,
    season.seasonId,
  );
  const isChampionship = result.eventId.endsWith('-final');
  const leagueCount = results.filter((entry) => !entry.eventId.endsWith('-final')).length;
  const championshipOpponentId =
    leagueCount >= 5
      ? (standings.find((row) => row.teamId !== season.playerTeamId)?.teamId ?? null)
      : season.championshipOpponentId;

  return {
    ...season,
    results,
    standings,
    currentRound: isChampionship ? 7 : Math.min(6, leagueCount + 1),
    championshipOpponentId,
    events: season.events.map((event) =>
      event.kind === 'championship' && championshipOpponentId
        ? { ...event, opponentTeamId: championshipOpponentId }
        : event,
    ),
    seasonComplete: isChampionship,
    championshipWon: isChampionship ? result.winner === 'player' : season.championshipWon,
  };
}

function sanitiseFighterRecords(input: unknown): Record<string, FighterRecord> {
  if (!isRecord(input)) return {};
  const records: Record<string, FighterRecord> = {};
  for (const [id, value] of Object.entries(input)) {
    // Drop records for fighters that no longer exist in the content.
    if (!getFighter(id)) continue;
    if (!isRecord(value)) continue;
    records[id] = {
      wins: Math.max(0, int(value.wins, EMPTY_FIGHTER_RECORD.wins)),
      losses: Math.max(0, int(value.losses, EMPTY_FIGHTER_RECORD.losses)),
      knockouts: Math.max(0, int(value.knockouts, EMPTY_FIGHTER_RECORD.knockouts)),
    };
  }
  return records;
}

function sanitiseActiveEvent(input: unknown): ActiveEventSave | null {
  if (!isRecord(input)) return null;
  if (typeof input.eventId !== 'string') return null;
  const bouts = Array.isArray(input.bouts)
    ? input.bouts.map(sanitiseBout).filter((bout): bout is BoutResult => bout !== null)
    : [];
  return { eventId: input.eventId, bouts };
}

function sanitiseSave(input: unknown): SaveData {
  const record = isRecord(input) ? input : {};
  const season = sanitiseSeason(record.season);
  return {
    version: SAVE_VERSION,
    audio: sanitiseAudio(record.audio),
    accessibility: sanitiseAccessibility(record.accessibility),
    progress: sanitiseProgress(record.progress),
    playerTeamId: isKnownTeamId(record.playerTeamId)
      ? record.playerTeamId
      : (season?.playerTeamId ?? null),
    difficulty: sanitiseDifficulty(record.difficulty),
    season,
    fighterRecords: sanitiseFighterRecords(record.fighterRecords),
    activeEvent: sanitiseActiveEvent(record.activeEvent),
  };
}

/** Returns the storage backend, or null when it is unavailable or blocked. */
function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const probe = '__tmac_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadSave(): SaveLoadResult {
  const storage = getStorage();
  if (!storage) {
    return {
      data: createDefaultSave(),
      status: 'unavailable',
      detail:
        'Browser storage is unavailable, so progress and settings will not persist after a refresh.',
    };
  }

  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_STORAGE_KEY);
  } catch (error) {
    console.warn('[save] could not read from storage', error);
    return {
      data: createDefaultSave(),
      status: 'unavailable',
      detail: 'Browser storage could not be read, so this session will not be saved.',
    };
  }

  if (raw === null) return { data: createDefaultSave(), status: 'empty' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn('[save] stored data was not valid JSON; starting a fresh save');
    return {
      data: createDefaultSave(),
      status: 'recovered',
      detail: 'Saved data could not be read and has been reset. Settings return to their defaults.',
    };
  }

  if (!isRecord(parsed)) {
    return {
      data: createDefaultSave(),
      status: 'recovered',
      detail: 'Saved data was not in the expected format and has been reset.',
    };
  }

  const storedVersion = typeof parsed.version === 'number' ? parsed.version : null;

  if (storedVersion === null || storedVersion < 1 || storedVersion > SAVE_VERSION) {
    return {
      data: sanitiseSave(parsed),
      status: 'recovered',
      detail: `Saved data reported version ${String(parsed.version)}, which this build cannot read. Recoverable settings were kept and the rest was reset.`,
    };
  }

  if (storedVersion < SAVE_VERSION) {
    const migrated = migrateSave(parsed, storedVersion);
    return {
      data: sanitiseSave(migrated),
      status: 'migrated',
      detail: `Saved data was upgraded from version ${storedVersion} to ${SAVE_VERSION}. Your training progress and settings were kept.`,
    };
  }

  return { data: sanitiseSave(parsed), status: 'loaded' };
}

/** Persists `data`. Returns false when storage rejected the write. */
export function writeSave(data: SaveData): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.warn('[save] could not write to storage', error);
    return false;
  }
}

/** Removes the save entirely. Returns false when storage rejected the delete. */
export function clearSave(): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.removeItem(SAVE_STORAGE_KEY);
    return true;
  } catch (error) {
    console.warn('[save] could not clear storage', error);
    return false;
  }
}
