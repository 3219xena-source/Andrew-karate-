/**
 * Application state.
 *
 * A single Zustand store holds the current screen, the player's selections,
 * audio and accessibility preferences, tutorial progress and the save-system
 * status. Screens read from it and dispatch through the actions below; they
 * never write persistence or audio directly.
 *
 * Persistence policy: every action that changes durable state writes the whole
 * save synchronously. The save is small and writes are infrequent (a selection,
 * a completed objective, a settings change), so there is no debounce to reason
 * about and no window in which a refresh loses progress.
 */

import { create } from 'zustand';
import { getFighter, getRoster } from '../data/fighters.ts';
import { getTeam } from '../data/teams.ts';
import { TUTORIAL_OBJECTIVES } from '../data/tutorial.ts';
import { audioManager } from '../systems/audio/audioManager.ts';
import { clearSave, loadSave, writeSave, type SaveLoadStatus } from '../systems/save/saveManager.ts';
import type { Fighter } from '../types/fighter.ts';
import type { Team, TeamId } from '../types/team.ts';
import {
  createDefaultSave,
  type AccessibilitySettings,
  type AudioSettings,
  type ProgressData,
  type SaveData,
} from '../types/save.ts';

/** Every screen in the Stage 1 journey. */
export type ScreenId =
  | 'title'
  | 'settings'
  | 'map'
  | 'team'
  | 'fighter-select'
  | 'dojo'
  | 'stage-complete'
  | 'tournament';

/** A transient message shown to the player, e.g. a save-recovery notice. */
export interface Notice {
  readonly id: number;
  readonly tone: 'info' | 'warning';
  readonly message: string;
}

export interface GameState {
  // ── Navigation ────────────────────────────────────────────────────────────
  screen: ScreenId;
  /** Screen to return to when the settings screen is dismissed. */
  settingsReturnScreen: ScreenId;

  // ── Persistent state ──────────────────────────────────────────────────────
  audio: AudioSettings;
  accessibility: AccessibilitySettings;
  progress: ProgressData;

  // ── Session state ─────────────────────────────────────────────────────────
  /** How the save loaded on boot. Surfaced in Settings for transparency. */
  saveStatus: SaveLoadStatus;
  /** False when a write has failed; the UI warns that progress is not saving. */
  savePersisting: boolean;
  notices: Notice[];
  /** Fighter highlighted on the selection screen before confirmation. */
  previewFighterId: string | null;
  /** True once the player has interacted, which is when audio may start. */
  audioUnlocked: boolean;

  // ── Actions ───────────────────────────────────────────────────────────────
  hydrate: () => void;
  goToScreen: (screen: ScreenId) => void;
  openSettings: () => void;
  closeSettings: () => void;
  startNewGame: () => void;
  continueGame: () => void;

  setAudioSettings: (patch: Partial<AudioSettings>) => void;
  toggleMasterAudio: () => void;
  setReducedMotion: (value: boolean) => void;

  selectTeam: (teamId: TeamId) => void;
  previewFighter: (fighterId: string | null) => void;
  selectFighter: (fighterId: string) => void;

  completeObjective: (objectiveId: string) => void;
  completeTutorial: () => void;
  restartTutorial: () => void;
  resetProgress: () => void;

  dismissNotice: (id: number) => void;
  markAudioUnlocked: () => void;
}

let noticeSequence = 0;

function makeNotice(tone: Notice['tone'], message: string): Notice {
  noticeSequence += 1;
  return { id: noticeSequence, tone, message };
}

/** Assembles the durable slice of state into a save record. */
function toSaveData(state: Pick<GameState, 'audio' | 'accessibility' | 'progress'>): SaveData {
  return {
    version: createDefaultSave().version,
    audio: state.audio,
    accessibility: state.accessibility,
    progress: state.progress,
  };
}

export const useGameStore = create<GameState>()((set, get) => {
  /**
   * Writes the durable slice and records whether persistence is working. A
   * failed write raises a visible notice exactly once rather than silently
   * dropping progress.
   */
  const persist = (): void => {
    const state = get();
    const ok = writeSave(toSaveData(state));
    if (!ok && state.savePersisting) {
      set({
        savePersisting: false,
        notices: [
          ...state.notices,
          makeNotice(
            'warning',
            'Progress could not be saved to this browser. You can keep playing, but this session will not be restored after a refresh.',
          ),
        ],
      });
    } else if (ok && !state.savePersisting) {
      set({ savePersisting: true });
    }
  };

  return {
    screen: 'title',
    settingsReturnScreen: 'title',

    audio: createDefaultSave().audio,
    accessibility: createDefaultSave().accessibility,
    progress: createDefaultSave().progress,

    saveStatus: 'empty',
    savePersisting: true,
    notices: [],
    previewFighterId: null,
    audioUnlocked: false,

    hydrate: () => {
      const result = loadSave();

      // Respect the operating system's reduced-motion preference the first time
      // the game runs; an explicit choice in Settings overrides it thereafter.
      const prefersReduced =
        result.status === 'empty' &&
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const accessibility = prefersReduced
        ? { ...result.data.accessibility, reducedMotion: true }
        : result.data.accessibility;

      const notices: Notice[] = [];
      if (result.detail) {
        notices.push(makeNotice(result.status === 'migrated' ? 'info' : 'warning', result.detail));
      }

      set({
        audio: result.data.audio,
        accessibility,
        progress: result.data.progress,
        saveStatus: result.status,
        savePersisting: result.status !== 'unavailable',
        notices,
        previewFighterId: result.data.progress.selectedFighterId,
      });

      audioManager.setSettings(result.data.audio);
    },

    goToScreen: (screen) => {
      set({ screen });
    },

    openSettings: () => {
      const current = get().screen;
      set({ screen: 'settings', settingsReturnScreen: current === 'settings' ? 'title' : current });
    },

    closeSettings: () => {
      set({ screen: get().settingsReturnScreen });
    },

    startNewGame: () => {
      // A new game clears selections and tutorial progress but deliberately
      // keeps audio and accessibility preferences, which are player settings
      // rather than game progress.
      set((state) => ({
        progress: {
          selectedTeamId: null,
          selectedFighterId: null,
          completedObjectiveIds: [],
          tutorialComplete: false,
          stage1Complete: false,
          firstTournamentUnlocked: false,
        },
        previewFighterId: null,
        screen: 'map',
        notices: state.notices,
      }));
      persist();
    },

    continueGame: () => {
      const { progress } = get();
      // Resume at the furthest point the save can justify.
      if (progress.stage1Complete) set({ screen: 'stage-complete' });
      else if (progress.selectedFighterId) set({ screen: 'dojo' });
      else if (progress.selectedTeamId) set({ screen: 'fighter-select' });
      else set({ screen: 'map' });
    },

    setAudioSettings: (patch) => {
      const audio = { ...get().audio, ...patch };
      set({ audio });
      audioManager.setSettings(audio);
      persist();
    },

    toggleMasterAudio: () => {
      get().setAudioSettings({ masterEnabled: !get().audio.masterEnabled });
    },

    setReducedMotion: (value) => {
      set({ accessibility: { ...get().accessibility, reducedMotion: value } });
      persist();
    },

    selectTeam: (teamId) => {
      const team = getTeam(teamId);
      if (!team) {
        console.warn(`[state] ignoring selection of unknown team "${teamId}"`);
        return;
      }
      const previous = get().progress.selectedTeamId;
      const roster = getRoster(teamId);
      const previewFighterId = roster.find((fighter) => fighter.unlocked)?.id ?? null;

      set((state) => ({
        progress: {
          ...state.progress,
          selectedTeamId: teamId,
          // Changing club clears the fighter, which would otherwise belong to
          // a team the player is no longer representing.
          selectedFighterId: previous === teamId ? state.progress.selectedFighterId : null,
        },
        previewFighterId: previous === teamId ? state.previewFighterId : previewFighterId,
        screen: 'team',
      }));
      persist();
    },

    previewFighter: (fighterId) => {
      set({ previewFighterId: fighterId });
    },

    selectFighter: (fighterId) => {
      const fighter = getFighter(fighterId);
      if (!fighter || !fighter.unlocked) {
        console.warn(`[state] ignoring selection of unavailable fighter "${fighterId}"`);
        return;
      }
      set((state) => ({
        progress: { ...state.progress, selectedFighterId: fighter.id, selectedTeamId: fighter.teamId },
        previewFighterId: fighter.id,
        screen: 'dojo',
      }));
      persist();
    },

    completeObjective: (objectiveId) => {
      const known = TUTORIAL_OBJECTIVES.some((objective) => objective.id === objectiveId);
      if (!known) {
        console.warn(`[state] ignoring completion of unknown objective "${objectiveId}"`);
        return;
      }
      if (get().progress.completedObjectiveIds.includes(objectiveId)) return;

      set((state) => ({
        progress: {
          ...state.progress,
          completedObjectiveIds: [...state.progress.completedObjectiveIds, objectiveId],
        },
      }));
      persist();
    },

    completeTutorial: () => {
      if (get().progress.tutorialComplete) return;
      set((state) => ({
        progress: {
          ...state.progress,
          completedObjectiveIds: TUTORIAL_OBJECTIVES.map((objective) => objective.id),
          tutorialComplete: true,
          stage1Complete: true,
          firstTournamentUnlocked: true,
        },
        screen: 'stage-complete',
      }));
      persist();
    },

    restartTutorial: () => {
      set((state) => ({
        progress: { ...state.progress, completedObjectiveIds: [], tutorialComplete: false },
        screen: 'dojo',
      }));
      persist();
    },

    resetProgress: () => {
      const cleared = createDefaultSave();
      clearSave();
      set((state) => ({
        progress: cleared.progress,
        previewFighterId: null,
        screen: 'title',
        notices: [...state.notices, makeNotice('info', 'Progress has been reset. Audio settings were kept.')],
      }));
      // Re-write immediately so the retained audio settings survive the clear.
      persist();
    },

    dismissNotice: (id) => {
      set((state) => ({ notices: state.notices.filter((notice) => notice.id !== id) }));
    },

    markAudioUnlocked: () => {
      if (get().audioUnlocked) return;
      audioManager.unlock();
      audioManager.setSettings(get().audio);
      set({ audioUnlocked: true });
    },
  };
});

// ── Derived selectors ───────────────────────────────────────────────────────

export function selectSelectedTeam(state: GameState): Team | undefined {
  return getTeam(state.progress.selectedTeamId);
}

export function selectSelectedFighter(state: GameState): Fighter | undefined {
  return getFighter(state.progress.selectedFighterId);
}

export function selectPreviewFighter(state: GameState): Fighter | undefined {
  return getFighter(state.previewFighterId ?? state.progress.selectedFighterId);
}

/** Fraction of the tutorial completed, 0..1. */
export function selectTutorialCompletion(state: GameState): number {
  if (TUTORIAL_OBJECTIVES.length === 0) return 0;
  return state.progress.completedObjectiveIds.length / TUTORIAL_OBJECTIVES.length;
}

/** True when there is enough saved state for the title screen to offer Continue. */
export function selectHasResumableProgress(state: GameState): boolean {
  const { progress } = state;
  return (
    progress.selectedTeamId !== null ||
    progress.selectedFighterId !== null ||
    progress.completedObjectiveIds.length > 0
  );
}
