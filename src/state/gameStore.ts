/**
 * Application state.
 *
 * A single Zustand store holds the current screen, the player's club and
 * fighter, audio and accessibility preferences, Stage 1 training progress, the
 * Stage 2 season, and the club event currently being contested. Screens read
 * from it and dispatch through the actions below; they never write persistence
 * or audio directly.
 *
 * Persistence policy: every action that changes durable state writes the whole
 * save synchronously. The save is small and writes are infrequent — a
 * selection, a completed bout, a settings change — so there is no debounce to
 * reason about and no window in which a refresh loses progress.
 *
 * Mid-bout policy: a bout that is in progress is NOT saved. A refresh restarts
 * that bout from round one; every bout already completed stays won.
 */

import { create } from 'zustand';
import { getFighter, getRoster } from '../data/fighters.ts';
import { DEFAULT_PLAYER_TEAM_ID, getTeam } from '../data/teams.ts';
import { TUTORIAL_OBJECTIVES } from '../data/tutorial.ts';
import { getVenue } from '../data/venues.ts';
import { audioManager } from '../systems/audio/audioManager.ts';
import type { Difficulty } from '../systems/ai/opponentAI.ts';
import { clearSave, loadSave, writeSave, type SaveLoadStatus } from '../systems/save/saveManager.ts';
import { EventController } from '../systems/season/eventController.ts';
import {
  applyEventResult,
  createSeason,
  eventStatus,
  nextEvent,
  playerPosition,
  qualifiedOnMerit,
} from '../systems/season/seasonEngine.ts';
import type { Fighter } from '../types/fighter.ts';
import { EMPTY_FIGHTER_RECORD } from '../types/fighter.ts';
import type { BoutResult, EventResult, SeasonEvent, SeasonState } from '../types/season.ts';
import type { Team, TeamId } from '../types/team.ts';
import type { Venue } from '../types/venue.ts';
import {
  createDefaultSave,
  type AccessibilitySettings,
  type AudioSettings,
  type ProgressData,
  type SaveData,
} from '../types/save.ts';

/** Every screen in the game. */
export type ScreenId =
  | 'title'
  | 'settings'
  | 'club-select'
  | 'team'
  | 'fighter-select'
  | 'dojo'
  | 'stage-complete'
  | 'season'
  | 'event-preview'
  | 'versus'
  | 'fight'
  | 'bout-result'
  | 'event-result'
  | 'standings'
  | 'championship-qualification'
  | 'season-complete'
  | 'credits';

export interface Notice {
  readonly id: number;
  readonly tone: 'info' | 'warning';
  readonly message: string;
}

/** The bout currently being contested, held in memory only. */
export interface ActiveBout {
  readonly index: number;
  readonly playerFighter: Fighter;
  readonly opponentFighter: Fighter;
  readonly isTieBreaker: boolean;
}

export interface GameState {
  // ── Navigation ────────────────────────────────────────────────────────────
  screen: ScreenId;
  settingsReturnScreen: ScreenId;

  // ── Persistent state ──────────────────────────────────────────────────────
  audio: AudioSettings;
  accessibility: AccessibilitySettings;
  progress: ProgressData;
  playerTeamId: TeamId | null;
  difficulty: Difficulty;
  season: SeasonState | null;
  fighterRecords: Record<string, { wins: number; losses: number; knockouts: number }>;

  // ── Session state ─────────────────────────────────────────────────────────
  saveStatus: SaveLoadStatus;
  savePersisting: boolean;
  notices: Notice[];
  previewFighterId: string | null;
  audioUnlocked: boolean;
  /** Set while a club event is being contested. */
  activeEventId: string | null;
  activeBout: ActiveBout | null;
  lastBoutResult: BoutResult | null;
  lastEventResult: EventResult | null;

  // ── Actions ───────────────────────────────────────────────────────────────
  hydrate: () => void;
  goToScreen: (screen: ScreenId) => void;
  openSettings: () => void;
  closeSettings: () => void;
  startNewGame: () => void;
  continueGame: () => void;

  setAudioSettings: (patch: Partial<AudioSettings>) => void;
  toggleMasterAudio: () => void;
  setAccessibility: (patch: Partial<AccessibilitySettings>) => void;
  setDifficulty: (difficulty: Difficulty) => void;

  selectTeam: (teamId: TeamId) => void;
  previewFighter: (fighterId: string | null) => void;
  selectFighter: (fighterId: string) => void;

  completeObjective: (objectiveId: string) => void;
  completeTutorial: () => void;
  restartTutorial: () => void;

  // Season
  startSeason: () => void;
  openEvent: (eventId: string) => void;
  beginNextBout: () => void;
  recordBoutResult: (result: BoutResult) => void;
  continueAfterBout: () => void;
  finishEvent: () => void;
  startNewSeason: () => void;

  resetProgress: () => void;
  dismissNotice: (id: number) => void;
  markAudioUnlocked: () => void;
}

let noticeSequence = 0;

function makeNotice(tone: Notice['tone'], message: string): Notice {
  noticeSequence += 1;
  return { id: noticeSequence, tone, message };
}

/**
 * The controller for the event in progress. Held outside the store because it
 * is behaviour, not state — the state it owns (completed bouts) is mirrored
 * into the save on every change.
 */
let eventController: EventController | null = null;

/** Rebuilds the controller for `eventId` from the season and saved bouts. */
function buildController(
  season: SeasonState,
  eventId: string,
  completedBouts: readonly BoutResult[],
): EventController | null {
  const event = season.events.find((entry) => entry.id === eventId);
  if (!event) return null;
  const opponentTeamId = event.opponentTeamId ?? season.championshipOpponentId;
  if (!opponentTeamId) return null;

  return new EventController({
    eventId,
    playerTeamId: season.playerTeamId,
    opponentTeamId,
    playerRoster: getRoster(season.playerTeamId),
    opponentRoster: getRoster(opponentTeamId),
    completedBouts,
  });
}

export const useGameStore = create<GameState>()((set, get) => {
  /** Assembles the durable slice into a save record. */
  const toSaveData = (): SaveData => {
    const state = get();
    return {
      version: createDefaultSave().version,
      audio: state.audio,
      accessibility: state.accessibility,
      progress: state.progress,
      playerTeamId: state.playerTeamId,
      difficulty: state.difficulty,
      season: state.season,
      fighterRecords: state.fighterRecords,
      activeEvent:
        state.activeEventId && eventController
          ? { eventId: state.activeEventId, bouts: eventController.getCompletedBouts() }
          : null,
    };
  };

  const persist = (): void => {
    const state = get();
    const ok = writeSave(toSaveData());
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

  /** Adds a win or a loss to both fighters' career records. */
  const recordCareer = (result: BoutResult): void => {
    const records = { ...get().fighterRecords };
    const bump = (id: string, won: boolean, ko: boolean): void => {
      const current = records[id] ?? EMPTY_FIGHTER_RECORD;
      records[id] = {
        wins: current.wins + (won ? 1 : 0),
        losses: current.losses + (won ? 0 : 1),
        knockouts: current.knockouts + (won && ko ? 1 : 0),
      };
    };
    const ko = result.endReason === 'knockout';
    bump(result.playerFighterId, result.winner === 'player', ko);
    bump(result.opponentFighterId, result.winner === 'opponent', ko);
    set({ fighterRecords: records });
  };

  return {
    screen: 'title',
    settingsReturnScreen: 'title',

    audio: createDefaultSave().audio,
    accessibility: createDefaultSave().accessibility,
    progress: createDefaultSave().progress,
    playerTeamId: null,
    difficulty: createDefaultSave().difficulty,
    season: null,
    fighterRecords: {},

    saveStatus: 'empty',
    savePersisting: true,
    notices: [],
    previewFighterId: null,
    audioUnlocked: false,
    activeEventId: null,
    activeBout: null,
    lastBoutResult: null,
    lastEventResult: null,

    hydrate: () => {
      const result = loadSave();

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

      // Restore a partly-played event so completed bouts are not lost.
      eventController = null;
      let activeEventId: string | null = null;
      if (result.data.season && result.data.activeEvent) {
        const restored = buildController(
          result.data.season,
          result.data.activeEvent.eventId,
          result.data.activeEvent.bouts,
        );
        if (restored && !restored.isComplete()) {
          eventController = restored;
          activeEventId = result.data.activeEvent.eventId;
        }
      }

      set({
        audio: result.data.audio,
        accessibility,
        progress: result.data.progress,
        playerTeamId: result.data.playerTeamId,
        difficulty: result.data.difficulty,
        season: result.data.season,
        fighterRecords: { ...result.data.fighterRecords },
        saveStatus: result.status,
        savePersisting: result.status !== 'unavailable',
        notices,
        previewFighterId: result.data.progress.selectedFighterId,
        activeEventId,
        activeBout: null,
      });

      audioManager.setSettings(result.data.audio);
    },

    goToScreen: (screen) => set({ screen }),

    openSettings: () => {
      const current = get().screen;
      set({ screen: 'settings', settingsReturnScreen: current === 'settings' ? 'title' : current });
    },

    closeSettings: () => set({ screen: get().settingsReturnScreen }),

    startNewGame: () => {
      // A new game clears selections, training and season progress but keeps
      // audio and accessibility settings, which are player preferences.
      eventController = null;
      set((state) => ({
        progress: {
          selectedTeamId: null,
          selectedFighterId: null,
          completedObjectiveIds: [],
          tutorialComplete: false,
          stage1Complete: false,
          firstTournamentUnlocked: false,
        },
        playerTeamId: null,
        season: null,
        fighterRecords: {},
        activeEventId: null,
        activeBout: null,
        lastBoutResult: null,
        lastEventResult: null,
        previewFighterId: null,
        screen: 'club-select',
        notices: state.notices,
      }));
      persist();
    },

    continueGame: () => {
      const state = get();
      // Resume at the furthest point the save can justify.
      if (state.season?.seasonComplete) set({ screen: 'season-complete' });
      else if (state.activeEventId) set({ screen: 'event-preview' });
      else if (state.season) set({ screen: 'season' });
      else if (state.progress.stage1Complete) set({ screen: 'stage-complete' });
      else if (state.progress.selectedFighterId) set({ screen: 'dojo' });
      else if (state.playerTeamId) set({ screen: 'fighter-select' });
      else set({ screen: 'club-select' });
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

    setAccessibility: (patch) => {
      set({ accessibility: { ...get().accessibility, ...patch } });
      persist();
    },

    setDifficulty: (difficulty) => {
      set({ difficulty });
      persist();
    },

    selectTeam: (teamId) => {
      const team = getTeam(teamId);
      if (!team) {
        console.warn(`[state] ignoring selection of unknown club "${teamId}"`);
        return;
      }
      const previous = get().progress.selectedTeamId;
      const roster = getRoster(teamId);

      set((state) => ({
        playerTeamId: teamId,
        progress: {
          ...state.progress,
          selectedTeamId: teamId,
          selectedFighterId: previous === teamId ? state.progress.selectedFighterId : null,
        },
        previewFighterId: previous === teamId ? state.previewFighterId : (roster[0]?.id ?? null),
        screen: 'team',
      }));
      persist();
    },

    previewFighter: (fighterId) => set({ previewFighterId: fighterId }),

    selectFighter: (fighterId) => {
      const fighter = getFighter(fighterId);
      if (!fighter || !fighter.unlocked) {
        console.warn(`[state] ignoring selection of unavailable fighter "${fighterId}"`);
        return;
      }
      set((state) => ({
        progress: {
          ...state.progress,
          selectedFighterId: fighter.id,
          selectedTeamId: fighter.teamId,
        },
        playerTeamId: fighter.teamId,
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
      if (get().progress.tutorialComplete) {
        set({ screen: 'stage-complete' });
        return;
      }
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

    // ── Season ──────────────────────────────────────────────────────────────

    startSeason: () => {
      const teamId = get().playerTeamId ?? get().progress.selectedTeamId ?? DEFAULT_PLAYER_TEAM_ID;
      const existing = get().season;
      if (existing && existing.playerTeamId === teamId && !existing.seasonComplete) {
        set({ screen: 'season' });
        return;
      }
      eventController = null;
      set({
        playerTeamId: teamId,
        season: createSeason(teamId),
        activeEventId: null,
        activeBout: null,
        lastEventResult: null,
        lastBoutResult: null,
        screen: 'season',
      });
      persist();
    },

    openEvent: (eventId) => {
      const season = get().season;
      if (!season) return;
      const event = season.events.find((entry) => entry.id === eventId);
      if (!event) {
        console.warn(`[state] ignoring unknown event "${eventId}"`);
        return;
      }
      if (eventStatus(season, event) !== 'available') {
        console.warn(`[state] event "${eventId}" is not available yet`);
        return;
      }

      // Reuse the controller when re-opening the event already in progress.
      if (get().activeEventId !== eventId || !eventController) {
        eventController = buildController(season, eventId, []);
      }
      if (!eventController) {
        set((state) => ({
          notices: [
            ...state.notices,
            makeNotice('warning', 'That event could not be prepared. Returning to the season.'),
          ],
          screen: 'season',
        }));
        return;
      }

      set({ activeEventId: eventId, activeBout: null, screen: 'event-preview' });
      persist();
    },

    beginNextBout: () => {
      if (!eventController) return;
      const pairing = eventController.getNextPairing();
      if (!pairing) {
        get().finishEvent();
        return;
      }
      set({
        activeBout: {
          index: pairing.index,
          playerFighter: pairing.player,
          opponentFighter: pairing.opponent,
          isTieBreaker: pairing.index >= 6,
        },
        screen: 'versus',
      });
    },

    recordBoutResult: (result) => {
      if (!eventController) return;
      eventController.recordBout(result);
      recordCareer(result);
      set({ lastBoutResult: result, screen: 'bout-result' });
      persist();
    },

    continueAfterBout: () => {
      if (!eventController) {
        set({ screen: 'season' });
        return;
      }
      if (eventController.isComplete()) {
        get().finishEvent();
        return;
      }
      get().beginNextBout();
    },

    finishEvent: () => {
      const season = get().season;
      const result = eventController?.getResult();
      if (!season || !result) {
        set({ screen: 'season' });
        return;
      }

      const updated = applyEventResult(season, result);
      eventController = null;
      set({
        season: updated,
        lastEventResult: result,
        activeEventId: null,
        activeBout: null,
        screen: 'event-result',
      });
      persist();
    },

    startNewSeason: () => {
      const teamId = get().playerTeamId ?? DEFAULT_PLAYER_TEAM_ID;
      eventController = null;
      set({
        season: createSeason(teamId),
        activeEventId: null,
        activeBout: null,
        lastEventResult: null,
        lastBoutResult: null,
        screen: 'season',
      });
      persist();
    },

    resetProgress: () => {
      const cleared = createDefaultSave();
      clearSave();
      eventController = null;
      set((state) => ({
        progress: cleared.progress,
        playerTeamId: null,
        season: null,
        fighterRecords: {},
        activeEventId: null,
        activeBout: null,
        lastBoutResult: null,
        lastEventResult: null,
        previewFighterId: null,
        screen: 'title',
        notices: [
          ...state.notices,
          makeNotice('info', 'Progress has been reset. Audio settings were kept.'),
        ],
      }));
      persist();
    },

    dismissNotice: (id) =>
      set((state) => ({ notices: state.notices.filter((notice) => notice.id !== id) })),

    markAudioUnlocked: () => {
      if (get().audioUnlocked) return;
      audioManager.unlock();
      audioManager.setSettings(get().audio);
      set({ audioUnlocked: true });
    },
  };
});

// ── Controller access, for screens that need live event state ───────────────

/** The controller for the event in progress, or null. */
export function getEventController(): EventController | null {
  return eventController;
}

// ── Derived selectors ───────────────────────────────────────────────────────

export function selectPlayerTeam(state: GameState): Team | undefined {
  return getTeam(state.playerTeamId ?? state.progress.selectedTeamId);
}

export function selectSelectedTeam(state: GameState): Team | undefined {
  return getTeam(state.progress.selectedTeamId ?? state.playerTeamId);
}

export function selectSelectedFighter(state: GameState): Fighter | undefined {
  return getFighter(state.progress.selectedFighterId);
}

export function selectPreviewFighter(state: GameState): Fighter | undefined {
  return getFighter(state.previewFighterId ?? state.progress.selectedFighterId);
}

export function selectTutorialCompletion(state: GameState): number {
  if (TUTORIAL_OBJECTIVES.length === 0) return 0;
  return state.progress.completedObjectiveIds.length / TUTORIAL_OBJECTIVES.length;
}

export function selectHasResumableProgress(state: GameState): boolean {
  return (
    state.playerTeamId !== null ||
    state.season !== null ||
    state.progress.selectedTeamId !== null ||
    state.progress.selectedFighterId !== null ||
    state.progress.completedObjectiveIds.length > 0
  );
}

/** The event the player is currently working on, if any. */
export function selectActiveEvent(state: GameState): SeasonEvent | undefined {
  if (!state.season || !state.activeEventId) return undefined;
  return state.season.events.find((event) => event.id === state.activeEventId);
}

/** The next event to play in the season, if any. */
export function selectNextEvent(state: GameState): SeasonEvent | null {
  return state.season ? nextEvent(state.season) : null;
}

export function selectVenueForEvent(event: SeasonEvent | null | undefined): Venue | undefined {
  return getVenue(event?.venueId);
}

/** 1-based league position of the player's club, or 0 before any results. */
export function selectPlayerPosition(state: GameState): number {
  if (!state.season) return 0;
  return playerPosition(state.season.playerTeamId, state.season.standings);
}

/** True when the player earned a top-two finish rather than the host seed. */
export function selectQualifiedOnMerit(state: GameState): boolean {
  if (!state.season) return false;
  return qualifiedOnMerit(state.season.playerTeamId, state.season.standings);
}
