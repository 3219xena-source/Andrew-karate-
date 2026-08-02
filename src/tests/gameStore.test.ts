/**
 * Game state and persistence.
 *
 * Covers navigation, selection, audio preference saving, progress saving, the
 * Stage 1 completion flow and recovery from invalid save data.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TUTORIAL_OBJECTIVES } from '../data/tutorial.ts';
import {
  selectHasResumableProgress,
  selectTutorialCompletion,
  useGameStore,
} from '../state/gameStore.ts';
import { loadSave } from '../systems/save/saveManager.ts';
import { SAVE_STORAGE_KEY, createDefaultSave } from '../types/save.ts';

/** Returns the store to a known state without reloading the module. */
function resetStore(): void {
  window.localStorage.clear();
  const defaults = createDefaultSave();
  useGameStore.setState({
    screen: 'title',
    settingsReturnScreen: 'title',
    audio: defaults.audio,
    accessibility: defaults.accessibility,
    progress: defaults.progress,
    saveStatus: 'empty',
    savePersisting: true,
    notices: [],
    previewFighterId: null,
    audioUnlocked: false,
    playerTeamId: null,
    season: null,
    fighterRecords: {},
    activeEventId: null,
    activeBout: null,
    lastBoutResult: null,
    lastEventResult: null,
  });
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  resetStore();
});

describe('navigation', () => {
  it('starts a new game on the map with progress cleared', () => {
    useGameStore.setState({
      progress: {
        selectedTeamId: 'burnie',
        selectedFighterId: null,
        completedObjectiveIds: ['jump'],
        tutorialComplete: false,
        stage1Complete: false,
        firstTournamentUnlocked: false,
      },
    });

    useGameStore.getState().startNewGame();

    const state = useGameStore.getState();
    expect(state.screen).toBe('club-select');
    expect(state.progress.selectedTeamId).toBeNull();
    expect(state.progress.completedObjectiveIds).toEqual([]);
  });

  it('keeps audio settings when a new game starts', () => {
    useGameStore.getState().setAudioSettings({ musicVolume: 0.2, sfxEnabled: false });
    useGameStore.getState().startNewGame();
    const { audio } = useGameStore.getState();
    expect(audio.musicVolume).toBe(0.2);
    expect(audio.sfxEnabled).toBe(false);
  });

  it('returns to the previous screen when settings are dismissed', () => {
    useGameStore.getState().goToScreen('club-select');
    useGameStore.getState().openSettings();
    expect(useGameStore.getState().screen).toBe('settings');
    useGameStore.getState().closeSettings();
    expect(useGameStore.getState().screen).toBe('club-select');
  });

  it('resumes at the furthest point the save justifies', () => {
    const store = useGameStore.getState();

    store.continueGame();
    expect(useGameStore.getState().screen).toBe('club-select');

    useGameStore.setState((state) => ({
      playerTeamId: 'hobart',
      progress: { ...state.progress, selectedTeamId: 'hobart' },
    }));
    useGameStore.getState().continueGame();
    expect(useGameStore.getState().screen).toBe('fighter-select');

    useGameStore.setState((state) => ({
      progress: { ...state.progress, selectedFighterId: 'andrew-gillian' },
    }));
    useGameStore.getState().continueGame();
    expect(useGameStore.getState().screen).toBe('dojo');

    useGameStore.setState((state) => ({
      progress: { ...state.progress, stage1Complete: true },
    }));
    useGameStore.getState().continueGame();
    expect(useGameStore.getState().screen).toBe('stage-complete');
  });
});

describe('team and fighter selection', () => {
  it('selects a club and opens its team profile', () => {
    useGameStore.getState().selectTeam('devonport');
    const state = useGameStore.getState();
    expect(state.progress.selectedTeamId).toBe('devonport');
    expect(state.screen).toBe('team');
  });

  it('ignores an unknown club id', () => {
    useGameStore.getState().selectTeam('atlantis' as never);
    expect(useGameStore.getState().progress.selectedTeamId).toBeNull();
  });

  it('clears the selected fighter when the club changes', () => {
    useGameStore.getState().selectTeam('hobart');
    useGameStore.getState().selectFighter('andrew-gillian');
    expect(useGameStore.getState().progress.selectedFighterId).toBe('andrew-gillian');

    useGameStore.getState().selectTeam('burnie');
    expect(useGameStore.getState().progress.selectedFighterId).toBeNull();
  });

  it('keeps the selected fighter when the same club is re-selected', () => {
    useGameStore.getState().selectFighter('cathryn');
    useGameStore.getState().selectTeam('hobart');
    expect(useGameStore.getState().progress.selectedFighterId).toBe('cathryn');
  });

  it('selects a fighter and enters the dojo', () => {
    useGameStore.getState().selectFighter('janet-gillian');
    const state = useGameStore.getState();
    expect(state.progress.selectedFighterId).toBe('janet-gillian');
    expect(state.progress.selectedTeamId).toBe('hobart');
    expect(state.screen).toBe('dojo');
  });

  it('lets the player represent any club, not just the default', () => {
    useGameStore.getState().selectFighter('bram-hollis');
    const state = useGameStore.getState();
    expect(state.progress.selectedFighterId).toBe('bram-hollis');
    expect(state.playerTeamId).toBe('burnie');
    expect(state.screen).toBe('dojo');
  });

  it('refuses an unknown fighter id', () => {
    useGameStore.getState().selectFighter('nobody-at-all');
    expect(useGameStore.getState().progress.selectedFighterId).toBeNull();
  });
});

describe('audio preferences', () => {
  it('writes audio settings to storage immediately', () => {
    useGameStore.getState().setAudioSettings({ musicVolume: 0.3, masterEnabled: false });
    const stored = loadSave();
    expect(stored.data.audio.musicVolume).toBe(0.3);
    expect(stored.data.audio.masterEnabled).toBe(false);
  });

  it('toggles master audio and persists the change', () => {
    expect(useGameStore.getState().audio.masterEnabled).toBe(true);
    useGameStore.getState().toggleMasterAudio();
    expect(useGameStore.getState().audio.masterEnabled).toBe(false);
    expect(loadSave().data.audio.masterEnabled).toBe(false);

    useGameStore.getState().toggleMasterAudio();
    expect(loadSave().data.audio.masterEnabled).toBe(true);
  });

  it('persists the reduced-motion preference', () => {
    useGameStore.getState().setAccessibility({ reducedMotion: true });
    expect(loadSave().data.accessibility.reducedMotion).toBe(true);
  });

  it('restores audio settings on hydrate', () => {
    useGameStore.getState().setAudioSettings({ sfxVolume: 0.15, musicEnabled: false });
    resetStoreKeepingStorage();
    useGameStore.getState().hydrate();
    const { audio } = useGameStore.getState();
    expect(audio.sfxVolume).toBe(0.15);
    expect(audio.musicEnabled).toBe(false);
  });
});

describe('tutorial progress', () => {
  it('records completed objectives without duplicates', () => {
    const store = useGameStore.getState();
    store.completeObjective('reach-mark');
    store.completeObjective('footwork');
    store.completeObjective('reach-mark');
    expect(useGameStore.getState().progress.completedObjectiveIds).toEqual([
      'reach-mark',
      'footwork',
    ]);
  });

  it('ignores an objective id that is not in the curriculum', () => {
    useGameStore.getState().completeObjective('do-a-backflip');
    expect(useGameStore.getState().progress.completedObjectiveIds).toEqual([]);
  });

  it('persists objective progress across a hydrate', () => {
    useGameStore.getState().completeObjective('jump');
    resetStoreKeepingStorage();
    useGameStore.getState().hydrate();
    expect(useGameStore.getState().progress.completedObjectiveIds).toEqual(['jump']);
  });

  it('reports the fraction of the session completed', () => {
    expect(selectTutorialCompletion(useGameStore.getState())).toBe(0);
    useGameStore.getState().completeObjective('reach-mark');
    expect(selectTutorialCompletion(useGameStore.getState())).toBeCloseTo(
      1 / TUTORIAL_OBJECTIVES.length,
    );
  });
});

describe('stage 1 completion', () => {
  it('marks the session complete and unlocks the tournament placeholder', () => {
    useGameStore.getState().selectFighter('andrew-gillian');
    useGameStore.getState().completeTutorial();

    const { progress, screen } = useGameStore.getState();
    expect(progress.tutorialComplete).toBe(true);
    expect(progress.stage1Complete).toBe(true);
    expect(progress.firstTournamentUnlocked).toBe(true);
    expect(progress.completedObjectiveIds).toHaveLength(TUTORIAL_OBJECTIVES.length);
    expect(screen).toBe('stage-complete');
  });

  it('survives a reload', () => {
    useGameStore.getState().selectFighter('mrs-graham');
    useGameStore.getState().completeTutorial();

    resetStoreKeepingStorage();
    useGameStore.getState().hydrate();

    const { progress } = useGameStore.getState();
    expect(progress.stage1Complete).toBe(true);
    expect(progress.firstTournamentUnlocked).toBe(true);
    expect(progress.selectedFighterId).toBe('mrs-graham');
  });

  it('replays the session without losing the unlock', () => {
    useGameStore.getState().selectFighter('andrew-gillian');
    useGameStore.getState().completeTutorial();
    useGameStore.getState().restartTutorial();

    const { progress, screen } = useGameStore.getState();
    expect(progress.completedObjectiveIds).toEqual([]);
    expect(progress.tutorialComplete).toBe(false);
    expect(progress.stage1Complete).toBe(true);
    expect(progress.firstTournamentUnlocked).toBe(true);
    expect(screen).toBe('dojo');
  });
});

describe('reset and recovery', () => {
  it('clears progress but keeps audio settings', () => {
    useGameStore.getState().setAudioSettings({ musicVolume: 0.1 });
    useGameStore.getState().selectFighter('ales-gillian');
    useGameStore.getState().completeTutorial();

    useGameStore.getState().resetProgress();

    const state = useGameStore.getState();
    expect(state.progress.selectedFighterId).toBeNull();
    expect(state.progress.stage1Complete).toBe(false);
    expect(state.screen).toBe('title');
    expect(state.audio.musicVolume).toBe(0.1);
    expect(loadSave().data.audio.musicVolume).toBe(0.1);
  });

  it('raises a notice and still boots when the save is unreadable', () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, 'not json at all');
    useGameStore.getState().hydrate();

    const state = useGameStore.getState();
    expect(state.saveStatus).toBe('recovered');
    expect(state.notices).toHaveLength(1);
    expect(state.notices[0]?.tone).toBe('warning');
    expect(state.progress).toEqual(createDefaultSave().progress);
  });

  it('dismisses a notice on request', () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, '}{');
    useGameStore.getState().hydrate();
    const id = useGameStore.getState().notices[0]?.id;
    expect(id).toBeDefined();
    useGameStore.getState().dismissNotice(id!);
    expect(useGameStore.getState().notices).toHaveLength(0);
  });

  it('offers Continue only when there is something to resume', () => {
    expect(selectHasResumableProgress(useGameStore.getState())).toBe(false);
    useGameStore.getState().selectTeam('rosebery');
    expect(selectHasResumableProgress(useGameStore.getState())).toBe(true);
  });
});

/** Resets in-memory state while leaving localStorage intact, as a reload does. */
function resetStoreKeepingStorage(): void {
  const defaults = createDefaultSave();
  useGameStore.setState({
    screen: 'title',
    audio: defaults.audio,
    accessibility: defaults.accessibility,
    progress: defaults.progress,
    notices: [],
    previewFighterId: null,
    playerTeamId: null,
    season: null,
    fighterRecords: {},
  });
}
