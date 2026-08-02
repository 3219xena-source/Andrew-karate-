/**
 * Save manager.
 *
 * The important behaviour here is recovery: missing, malformed, hostile and
 * out-of-date save data must all resolve to a usable game rather than an
 * exception or a silently wrong state.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSave,
  loadSave,
  sanitiseAccessibility,
  sanitiseAudio,
  sanitiseProgress,
  writeSave,
} from '../systems/save/saveManager.ts';
import { migrateSave } from '../systems/save/migrations.ts';
import {
  DEFAULT_AUDIO_SETTINGS,
  SAVE_STORAGE_KEY,
  SAVE_VERSION,
  createDefaultSave,
  type SaveData,
} from '../types/save.ts';

function store(value: unknown): void {
  window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(value));
}

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loading', () => {
  it('returns defaults when no save exists', () => {
    const result = loadSave();
    expect(result.status).toBe('empty');
    expect(result.data).toEqual(createDefaultSave());
  });

  it('round-trips a valid save', () => {
    const save: SaveData = {
      playerTeamId: 'hobart',
      difficulty: 'standard',
      season: null,
      fighterRecords: {},
      activeEvent: null,
      version: SAVE_VERSION,
      audio: { ...DEFAULT_AUDIO_SETTINGS, musicVolume: 0.25, sfxEnabled: false },
      accessibility: { reducedMotion: true, screenShake: true, announcementCaptions: true },
      progress: {
        selectedTeamId: 'hobart',
        selectedFighterId: 'ales-gillian',
        completedObjectiveIds: ['reach-mark', 'footwork'],
        tutorialComplete: false,
        stage1Complete: false,
        firstTournamentUnlocked: false,
      },
    };

    expect(writeSave(save)).toBe(true);
    const result = loadSave();
    expect(result.status).toBe('loaded');
    expect(result.data).toEqual(save);
  });

  it('recovers from data that is not valid JSON', () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, '{ this is not json');
    const result = loadSave();
    expect(result.status).toBe('recovered');
    expect(result.detail).toBeTruthy();
    expect(result.data).toEqual(createDefaultSave());
  });

  it('recovers from valid JSON that is not an object', () => {
    store('a string');
    expect(loadSave().status).toBe('recovered');
    store([1, 2, 3]);
    expect(loadSave().status).toBe('recovered');
    store(null);
    expect(loadSave().status).toBe('recovered');
  });

  it('recovers from a save written by a newer build', () => {
    store({ ...createDefaultSave(), version: SAVE_VERSION + 5 });
    const result = loadSave();
    expect(result.status).toBe('recovered');
    expect(result.detail).toContain('cannot read');
    expect(result.data.version).toBe(SAVE_VERSION);
  });

  it('keeps readable fields when other fields are corrupt', () => {
    store({
      version: SAVE_VERSION,
      audio: { masterEnabled: false, musicVolume: 'loud', sfxVolume: 99 },
      accessibility: 'yes please',
      progress: { selectedTeamId: 'atlantis', completedObjectiveIds: 'all of them' },
    });

    const result = loadSave();
    expect(result.status).toBe('loaded');
    // The one readable audio field survives; the rest fall back to defaults.
    expect(result.data.audio.masterEnabled).toBe(false);
    expect(result.data.audio.musicVolume).toBe(DEFAULT_AUDIO_SETTINGS.musicVolume);
    expect(result.data.audio.sfxVolume).toBe(1);
    expect(result.data.accessibility.reducedMotion).toBe(false);
    expect(result.data.progress.selectedTeamId).toBeNull();
    expect(result.data.progress.completedObjectiveIds).toEqual([]);
  });

  it('reports storage as unavailable rather than throwing', () => {
    const original = window.localStorage.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    const result = loadSave();
    expect(result.status).toBe('unavailable');
    expect(result.data).toEqual(createDefaultSave());
    expect(writeSave(createDefaultSave())).toBe(false);

    vi.restoreAllMocks();
    window.localStorage.setItem = original;
  });

  it('clears the save on request', () => {
    writeSave(createDefaultSave());
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).not.toBeNull();
    expect(clearSave()).toBe(true);
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBeNull();
    expect(loadSave().status).toBe('empty');
  });
});

describe('sanitisation', () => {
  it('clamps volumes into the 0..1 range', () => {
    expect(sanitiseAudio({ musicVolume: 4, sfxVolume: -2 })).toMatchObject({
      musicVolume: 1,
      sfxVolume: 0,
    });
    expect(sanitiseAudio({ musicVolume: Number.NaN }).musicVolume).toBe(
      DEFAULT_AUDIO_SETTINGS.musicVolume,
    );
    expect(sanitiseAudio(null)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('defaults accessibility fields for unreadable input', () => {
    expect(sanitiseAccessibility({ reducedMotion: true })).toMatchObject({ reducedMotion: true });
    expect(sanitiseAccessibility(12)).toMatchObject({
      reducedMotion: false,
      screenShake: true,
      announcementCaptions: true,
    });
  });

  it('drops a fighter that no longer exists', () => {
    const progress = sanitiseProgress({
      selectedTeamId: 'hobart',
      selectedFighterId: 'someone-who-left',
    });
    expect(progress.selectedFighterId).toBeNull();
    expect(progress.selectedTeamId).toBe('hobart');
  });

  it('drops a fighter who does not belong to the saved club', () => {
    const progress = sanitiseProgress({
      selectedTeamId: 'burnie',
      selectedFighterId: 'andrew-gillian',
    });
    expect(progress.selectedFighterId).toBeNull();
  });

  it('de-duplicates and type-filters completed objective ids', () => {
    const progress = sanitiseProgress({
      completedObjectiveIds: ['jump', 'jump', 7, null, 'bow'],
    });
    expect(progress.completedObjectiveIds).toEqual(['jump', 'bow']);
  });

  it('derives the tournament unlock rather than trusting it from disk', () => {
    // A hand-edited save claiming the unlock without completing Stage 1.
    const cheated = sanitiseProgress({
      tutorialComplete: false,
      stage1Complete: true,
      firstTournamentUnlocked: true,
    });
    expect(cheated.stage1Complete).toBe(false);
    expect(cheated.firstTournamentUnlocked).toBe(false);

    const genuine = sanitiseProgress({
      tutorialComplete: true,
      stage1Complete: true,
      firstTournamentUnlocked: false,
    });
    expect(genuine.firstTournamentUnlocked).toBe(true);
  });
});

describe('migrations', () => {
  it('stamps the current version even when no migration is registered', () => {
    const migrated = migrateSave({ version: 1, audio: {} }, 1);
    expect(migrated.version).toBe(SAVE_VERSION);
  });

  it('preserves unknown fields so a future migration can still read them', () => {
    const migrated = migrateSave({ version: 1, futureField: 'keep me' }, 1);
    expect(migrated.futureField).toBe('keep me');
  });
});
