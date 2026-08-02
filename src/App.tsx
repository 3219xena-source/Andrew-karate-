/**
 * Application shell.
 *
 * Hydrates the save on mount, routes to the current screen, keeps the audio
 * manager in step with the player's settings, and unlocks audio on the first
 * user gesture (which browsers require).
 *
 * Routing is a state machine rather than a URL router: the Stage 1 journey is
 * strictly linear, and screens carry meaningful in-memory state (a live combat
 * session) that a URL cannot restore. If deep linking is needed later, the
 * `ScreenId` union is already the route table.
 */

import { useEffect, type JSX } from 'react';
import { ErrorBoundary } from './components/ui/ErrorBoundary.tsx';
import { Notices } from './components/ui/Notices.tsx';
import { DojoScreen } from './screens/DojoScreen.tsx';
import { FighterSelectScreen } from './screens/FighterSelectScreen.tsx';
import { MapScreen } from './screens/MapScreen.tsx';
import { SettingsScreen } from './screens/SettingsScreen.tsx';
import { StageCompleteScreen } from './screens/StageCompleteScreen.tsx';
import { TeamScreen } from './screens/TeamScreen.tsx';
import { TitleScreen } from './screens/TitleScreen.tsx';
import { FightScreen } from './screens/FightScreen.tsx';
import { EventPreviewScreen } from './screens/EventPreviewScreen.tsx';
import { SeasonHubScreen } from './screens/SeasonHubScreen.tsx';
import {
  BoutResultScreen,
  ChampionshipQualificationScreen,
  CreditsScreen,
  EventResultScreen,
  SeasonCompleteScreen,
  StandingsScreen,
  VersusScreen,
} from './screens/ResultScreens.tsx';
import { audioManager } from './systems/audio/audioManager.ts';
import { useGameStore, type ScreenId } from './state/gameStore.ts';

const SCREENS: Record<ScreenId, () => JSX.Element> = {
  title: TitleScreen,
  settings: SettingsScreen,
  'club-select': MapScreen,
  team: TeamScreen,
  'fighter-select': FighterSelectScreen,
  dojo: DojoScreen,
  'stage-complete': StageCompleteScreen,
  season: SeasonHubScreen,
  'event-preview': EventPreviewScreen,
  versus: VersusScreen,
  fight: FightScreen,
  'bout-result': BoutResultScreen,
  'event-result': EventResultScreen,
  standings: StandingsScreen,
  'championship-qualification': ChampionshipQualificationScreen,
  'season-complete': SeasonCompleteScreen,
  credits: CreditsScreen,
};

/** Screens where background music should play. The arena manages its own. */
const MUSIC_SCREENS: ReadonlySet<ScreenId> = new Set<ScreenId>([
  'title',
  'club-select',
  'team',
  'fighter-select',
  'stage-complete',
  'season',
  'event-preview',
  'versus',
  'standings',
  'championship-qualification',
  'season-complete',
  'credits',
]);

export function App() {
  const screen = useGameStore((state) => state.screen);
  const reducedMotion = useGameStore((state) => state.accessibility.reducedMotion);
  const hydrate = useGameStore((state) => state.hydrate);
  const markAudioUnlocked = useGameStore((state) => state.markAudioUnlocked);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Reduced motion is applied at the document root so it also covers portals
  // such as modals, which render outside the app subtree.
  useEffect(() => {
    document.documentElement.classList.toggle('reduced-motion', reducedMotion);
  }, [reducedMotion]);

  // Browsers only allow an AudioContext to start from a user gesture. One
  // listener on the document covers every entry point without every button
  // needing to know about it.
  useEffect(() => {
    const unlock = () => markAudioUnlocked();
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, [markAudioUnlocked]);

  // Suspend audio while the tab is hidden, so a backgrounded game is silent.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void audioManager.resume();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Music plays on the menu screens. The dojo and the arena manage their own
  // music request so it stops cleanly when a session or a bout begins.
  useEffect(() => {
    if (screen !== 'dojo' && screen !== 'fight') {
      audioManager.setMusicRequested(MUSIC_SCREENS.has(screen));
    }
  }, [screen]);

  const Screen = SCREENS[screen] ?? TitleScreen;

  return (
    <ErrorBoundary>
      <div className="app">
        <Notices />
        <Screen />
      </div>
    </ErrorBoundary>
  );
}
