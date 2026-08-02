/**
 * Tasmania team-selection map.
 *
 * The map itself is in `components/map/TasmaniaMap.tsx`; this screen owns the
 * highlight state and the information panel that accompanies it. Highlighting
 * follows both hover and keyboard focus, so the panel content is never
 * available to pointer users only.
 */

import { useRef, useState } from 'react';
import { TasmaniaMap } from '../components/map/TasmaniaMap.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Emblem } from '../components/ui/Emblem.tsx';
import { ScreenFrame } from '../components/ui/ScreenFrame.tsx';
import { FEATURED_TEAM_ID, TEAMS, getTeam } from '../data/teams.ts';
import { getRoster } from '../data/fighters.ts';
import { useGameStore } from '../state/gameStore.ts';
import type { TeamId } from '../types/team.ts';

export function MapScreen() {
  const selectedTeamId = useGameStore((state) => state.progress.selectedTeamId);
  const selectTeam = useGameStore((state) => state.selectTeam);
  const goToScreen = useGameStore((state) => state.goToScreen);

  const [focusedTeamId, setFocusedTeamId] = useState<TeamId>(selectedTeamId ?? FEATURED_TEAM_ID);
  const panelHeadingRef = useRef<HTMLHeadingElement>(null);
  const team = getTeam(focusedTeamId);

  /**
   * Activating a marker opens that club's panel rather than confirming the
   * club — confirmation is the panel's own Select team button. Focus follows to
   * the panel heading so a screen-reader user is taken to the new content.
   *
   * The focus move is synchronous on purpose. Deferring it to the next frame
   * left a window in which the player could move focus somewhere else and have
   * it yanked back to the heading a frame later.
   */
  const activateTeam = (teamId: TeamId) => {
    setFocusedTeamId(teamId);
    panelHeadingRef.current?.focus();
  };

  // The team list is static content; an empty list would mean the data layer
  // failed to load, which is worth stating plainly rather than rendering blank.
  if (TEAMS.length === 0 || !team) {
    return (
      <ScreenFrame eyebrow="Championship" title="Tasmania">
        <div className="state-block" role="alert">
          <h2 className="state-block__title">Club data could not be loaded</h2>
          <p className="state-block__body">
            The championship club records are missing or unreadable, so the map cannot be drawn.
            Reloading the page will retry.
          </p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </ScreenFrame>
    );
  }

  const roster = getRoster(team.id);

  return (
    <ScreenFrame
      eyebrow="Championship"
      title="Choose your club"
      wide
      footer={
        <Button variant="ghost" sound="menu-back" onClick={() => goToScreen('title')} data-testid="map-back">
          Back to title
        </Button>
      }
    >
      <div className="map-layout">
        <TasmaniaMap
          teams={TEAMS}
          selectedTeamId={selectedTeamId}
          focusedTeamId={focusedTeamId}
          onFocusTeam={setFocusedTeamId}
          onActivateTeam={activateTeam}
        />

        <section className="panel" aria-live="polite" data-testid="team-panel">
          <div className="team-panel__head">
            <Emblem team={team} size="large" />
            <div>
              <p className="panel__eyebrow">{team.location}</p>
              <h2 className="panel__title" ref={panelHeadingRef} tabIndex={-1}>
                {team.name}
              </h2>
              <div className="row row--wrap" style={{ marginTop: 'var(--space-2)' }}>
                <span className="badge badge--featured">{team.difficulty}</span>
                <span className="badge">{roster.length} fighters</span>
              </div>
            </div>
          </div>

          <dl className="team-panel__facts">
            <dt>Style</dt>
            <dd>{team.style}</dd>
            <dt>Strength</dt>
            <dd>{team.strength}</dd>
            <dt>Character</dt>
            <dd>{team.personality}</dd>
            <dt>Speciality</dt>
            <dd>{team.speciality}</dd>
            <dt>Coach</dt>
            <dd>{team.coach}</dd>
          </dl>

          <p className="text-small muted">{team.description}</p>

          <div style={{ marginTop: 'var(--space-5)' }}>
            <Button
              variant="primary"
              onClick={() => selectTeam(team.id)}
              data-testid="select-team"
              aria-label={`Select ${team.name}`}
            >
              Select team
            </Button>
          </div>
        </section>
      </div>
    </ScreenFrame>
  );
}
