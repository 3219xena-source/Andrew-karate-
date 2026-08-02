/**
 * Main navigation flow, rendered.
 *
 * These render the real screens and drive them the way a player would, so they
 * catch wiring mistakes that the store-level tests cannot see. The dojo's frame
 * loop is not exercised here — its rules are covered by the engine tests, and
 * the full journey through it is covered by the Playwright suite.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App.tsx';
import { useGameStore } from '../state/gameStore.ts';
import { loadSave } from '../systems/save/saveManager.ts';
import { createDefaultSave } from '../types/save.ts';

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
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
});

describe('title screen', () => {
  it('renders the title and the start control', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { level: 1, name: /tasmania martial arts championship/i }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: /six clubs/i })).toBeVisible();
    expect(screen.getByTestId('start-game')).toBeVisible();
  });

  it('hides Continue until there is progress to resume', async () => {
    render(<App />);
    expect(screen.queryByTestId('continue-game')).toBeNull();

    await act(async () => {
      useGameStore.getState().selectTeam('hobart');
      useGameStore.getState().goToScreen('title');
    });
    expect(await screen.findByTestId('continue-game')).toBeVisible();
  });

  it('states that the characters are fictionalised', () => {
    render(<App />);
    expect(screen.getByText(/characters and clubs in this game are fictionalised/i)).toBeVisible();
  });
});

describe('map screen', () => {
  it('shows six selectable location markers', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId('start-game'));

    for (const id of ['hobart', 'launceston', 'devonport', 'burnie', 'smithton', 'rosebery']) {
      expect(screen.getByTestId(`map-marker-${id}`)).toBeVisible();
    }
  });

  it('opens a valid team panel for every location', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId('start-game'));

    const expectations: Array<[string, string]> = [
      ['hobart', 'Hobart Southern Dojo'],
      ['launceston', 'Launceston Tamar Karate Club'],
      ['devonport', 'Devonport Coastal Martial Arts'],
      ['burnie', 'Burnie Emu Bay Karate'],
      ['smithton', 'Smithton Circular Head Dojo'],
      ['rosebery', 'Rosebery West Coast Kung Fu & Karate'],
    ];

    for (const [id, name] of expectations) {
      await user.click(screen.getByTestId(`map-marker-${id}`));
      const panel = screen.getByTestId('team-panel');
      expect(within(panel).getByRole('heading', { name })).toBeVisible();
      expect(within(panel).getByTestId('select-team')).toBeVisible();
      // Every panel carries the full identity record, not just a name.
      expect(within(panel).getByText('Speciality')).toBeVisible();
      expect(within(panel).getByText('Strength')).toBeVisible();
    }
  });

  it('shows each club’s difficulty band on the panel', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId('start-game'));

    const panel = screen.getByTestId('team-panel');
    expect(within(panel).getByText('competitive')).toBeVisible();

    await user.click(screen.getByTestId('map-marker-smithton'));
    expect(within(screen.getByTestId('team-panel')).getByText('approachable')).toBeVisible();
  });

  it('advances to the team profile when a club is confirmed', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId('start-game'));
    await user.click(screen.getByTestId('select-team'));

    expect(useGameStore.getState().screen).toBe('team');
    expect(screen.getByTestId('team-roster')).toBeVisible();
  });
});

describe('team profile', () => {
  it('lists all six fighters of the featured club', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId('start-game'));
    await user.click(screen.getByTestId('select-team'));

    const roster = screen.getByTestId('team-roster');
    expect(within(roster).getAllByRole('listitem')).toHaveLength(6);
    for (const name of ['Andrew Gillian', 'Ales', 'Cathryn', 'Mr Graham', 'Janet', 'Mrs Graham']) {
      expect(within(roster).getByText(name)).toBeVisible();
    }
  });

  it('offers a full six-fighter roster for every club', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId('start-game'));
    await user.click(screen.getByTestId('map-marker-rosebery'));
    await user.click(screen.getByTestId('select-team'));

    expect(within(screen.getByTestId('team-roster')).getAllByRole('listitem')).toHaveLength(6);
    expect(screen.getByTestId('view-roster')).toBeEnabled();
  });
});

describe('fighter selection', () => {
  async function openFighterSelect(user: ReturnType<typeof userEvent.setup>) {
    render(<App />);
    await user.click(screen.getByTestId('start-game'));
    await user.click(screen.getByTestId('select-team'));
    await user.click(screen.getByTestId('view-roster'));
  }

  it('shows six fighter cards and a profile panel', async () => {
    const user = userEvent.setup();
    await openFighterSelect(user);

    expect(within(screen.getByTestId('fighter-grid')).getAllByRole('listitem')).toHaveLength(6);
    expect(screen.getByTestId('fighter-profile')).toBeVisible();
  });

  it('updates the profile panel when a fighter is highlighted', async () => {
    const user = userEvent.setup();
    await openFighterSelect(user);

    await user.click(screen.getByTestId('fighter-card-cathryn'));
    const profile = screen.getByTestId('fighter-profile');
    expect(within(profile).getByRole('heading', { name: 'Cathryn' })).toBeVisible();
    expect(within(profile).getByText(/Defensive karate/)).toBeVisible();
    expect(within(profile).getByText(/Read and Reply/)).toBeVisible();
  });

  it('renders all six ratings for the highlighted fighter', async () => {
    const user = userEvent.setup();
    await openFighterSelect(user);

    const profile = screen.getByTestId('fighter-profile');
    for (const label of ['Power', 'Speed', 'Defence', 'Technique', 'Stamina', 'Agility']) {
      expect(within(profile).getByRole('meter', { name: new RegExp(label, 'i') })).toBeInTheDocument();
    }
  });

  it('names the highlighted fighter’s strongest attributes', async () => {
    const user = userEvent.setup();
    await openFighterSelect(user);

    await user.click(screen.getByTestId('fighter-card-ales-gillian'));
    expect(screen.getByTestId('strongest-abilities')).toHaveTextContent(/Speed 92/);
  });

  it('marks junior students with their competition class', async () => {
    const user = userEvent.setup();
    await openFighterSelect(user);

    const card = screen.getByTestId('fighter-card-ales-gillian');
    expect(within(card).getByText('Junior')).toBeVisible();
  });

  it('confirms a selection and enters the dojo', async () => {
    const user = userEvent.setup();
    await openFighterSelect(user);

    await user.click(screen.getByTestId('fighter-card-mr-graham'));
    await user.click(screen.getByTestId('select-fighter'));

    expect(useGameStore.getState().progress.selectedFighterId).toBe('mr-graham');
    expect(useGameStore.getState().screen).toBe('dojo');
  });

  it('shows a visible pressed state on the highlighted card', async () => {
    const user = userEvent.setup();
    await openFighterSelect(user);

    await user.click(screen.getByTestId('fighter-card-janet-gillian'));
    expect(screen.getByTestId('fighter-card-janet-gillian')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('fighter-card-cathryn')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('audio controls', () => {
  it('toggles sound from the header on every major screen', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('audio-toggle'));
    expect(useGameStore.getState().audio.masterEnabled).toBe(false);

    await user.click(screen.getByTestId('start-game'));
    expect(screen.getByTestId('audio-toggle')).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByTestId('audio-toggle'));
    expect(useGameStore.getState().audio.masterEnabled).toBe(true);
  });

  it('exposes every audio control in settings', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId('open-settings'));

    expect(screen.getByTestId('setting-master')).toBeVisible();
    expect(screen.getByTestId('setting-music')).toBeVisible();
    expect(screen.getByTestId('setting-sfx')).toBeVisible();
    expect(screen.getByTestId('setting-music-volume')).toBeVisible();
    expect(screen.getByTestId('setting-sfx-volume')).toBeVisible();
  });

  it('persists a volume change from settings', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId('open-settings'));

    // jsdom does not implement range-input dragging, so the change event is
    // dispatched directly; the assertion is about the handler and the save.
    const slider = screen.getByTestId('setting-music-volume');
    fireEvent.change(slider, { target: { value: '20' } });

    expect(useGameStore.getState().audio.musicVolume).toBeCloseTo(0.2);
    expect(loadSave().data.audio.musicVolume).toBeCloseTo(0.2);
  });

  it('keeps the sound toggle reachable on the dojo screen', () => {
    useGameStore.getState().selectFighter('andrew-gillian');
    render(<App />);
    expect(screen.getByTestId('audio-toggle')).toBeVisible();
  });

  it('returns from settings to the screen it was opened from', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId('start-game'));
    await user.click(screen.getByRole('button', { name: /settings/i }));
    expect(useGameStore.getState().screen).toBe('settings');

    await user.click(screen.getByTestId('settings-back'));
    expect(useGameStore.getState().screen).toBe('club-select');
  });
});

describe('progress reset', () => {
  it('asks for confirmation before clearing progress', async () => {
    const user = userEvent.setup();
    useGameStore.getState().selectFighter('andrew-gillian');
    useGameStore.getState().completeTutorial();
    render(<App />);

    await act(async () => {
      useGameStore.getState().openSettings();
    });
    await user.click(await screen.findByTestId('reset-progress'));
    expect(screen.getByRole('dialog')).toBeVisible();

    await user.click(screen.getByTestId('confirm-reset'));
    expect(useGameStore.getState().progress.stage1Complete).toBe(false);
    expect(useGameStore.getState().screen).toBe('title');
  });
});

describe('stage completion', () => {
  it('reports the unlock and starts the championship season', async () => {
    const user = userEvent.setup();
    useGameStore.getState().selectFighter('andrew-gillian');
    useGameStore.getState().completeTutorial();
    render(<App />);

    expect(screen.getByTestId('stage-complete-panel')).toBeVisible();
    expect(screen.getByTestId('tournament-unlock-state')).toHaveTextContent('Unlocked');

    await user.click(screen.getByTestId('enter-tournament'));
    expect(screen.getByTestId('season-schedule')).toBeVisible();
    expect(useGameStore.getState().season?.events).toHaveLength(6);
  });

  it('replays the training session from the completion screen', async () => {
    const user = userEvent.setup();
    useGameStore.getState().selectFighter('andrew-gillian');
    useGameStore.getState().completeTutorial();
    render(<App />);

    await user.click(screen.getByTestId('replay-training'));
    expect(useGameStore.getState().screen).toBe('dojo');
    expect(useGameStore.getState().progress.completedObjectiveIds).toEqual([]);
  });
});

describe('error and loading states', () => {
  it('explains, rather than blanks, a dojo with no fighter selected', () => {
    useGameStore.setState({ screen: 'dojo' });
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent(/no fighter is selected/i);
  });

  it('explains a team screen with no club selected', () => {
    useGameStore.setState({ screen: 'team' });
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent(/no club is selected/i);
  });

  it('explains a season screen with no season running', () => {
    useGameStore.setState({ screen: 'season', season: null });
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent(/no season is running/i);
  });
});

describe('accessibility', () => {
  it('gives every screen a skip link and a main landmark', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole('link', { name: /skip to content/i })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();

    await user.click(screen.getByTestId('start-game'));
    expect(screen.getByRole('link', { name: /skip to content/i })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('reaches the start control with the keyboard alone', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.tab(); // skip link
    await user.tab(); // sound toggle is in the header, before the body
    let guard = 0;
    while (document.activeElement !== screen.getByTestId('start-game') && guard < 12) {
      await user.tab();
      guard += 1;
    }
    expect(document.activeElement).toBe(screen.getByTestId('start-game'));
  });

  it('applies the reduced-motion class to the document root', async () => {
    render(<App />);
    expect(document.documentElement.classList.contains('reduced-motion')).toBe(false);

    await act(async () => {
      useGameStore.getState().setAccessibility({ reducedMotion: true });
    });
    expect(document.documentElement.classList.contains('reduced-motion')).toBe(true);
  });
});
