/**
 * Team profile — the club's home screen after it has been chosen on the map.
 *
 * Shows the full club identity and its six-fighter roster at a glance, then
 * hands off to the fighter-selection screen. Clubs whose rosters are Stage 2
 * placeholders say so plainly here rather than presenting placeholder records
 * as finished content.
 */

import { Button } from '../components/ui/Button.tsx';
import { Emblem } from '../components/ui/Emblem.tsx';
import { Portrait } from '../components/ui/Portrait.tsx';
import { ScreenFrame } from '../components/ui/ScreenFrame.tsx';
import { getRoster } from '../data/fighters.ts';
import { FEATURED_TEAM_ID, getTeam } from '../data/teams.ts';
import { useGameStore } from '../state/gameStore.ts';

export function TeamScreen() {
  const selectedTeamId = useGameStore((state) => state.progress.selectedTeamId);
  const goToScreen = useGameStore((state) => state.goToScreen);
  const selectTeam = useGameStore((state) => state.selectTeam);

  const team = getTeam(selectedTeamId);

  if (!team) {
    return (
      <ScreenFrame eyebrow="Championship" title="No club selected">
        <div className="state-block" role="alert">
          <h2 className="state-block__title">No club is selected</h2>
          <p className="state-block__body">
            Choose a club on the Tasmania map before opening a team profile.
          </p>
          <Button variant="primary" onClick={() => goToScreen('map')}>
            Back to the map
          </Button>
        </div>
      </ScreenFrame>
    );
  }

  const roster = getRoster(team.id);
  const playable = roster.filter((fighter) => fighter.unlocked);
  const featured = team.status === 'featured';

  return (
    <ScreenFrame
      eyebrow={`${team.location} · Team profile`}
      title={team.name}
      footer={
        <>
          <Button variant="ghost" sound="menu-back" onClick={() => goToScreen('map')} data-testid="team-back">
            Back to map
          </Button>
          <Button
            variant="primary"
            onClick={() => goToScreen('fighter-select')}
            disabled={playable.length === 0}
            data-testid="view-roster"
          >
            Choose your fighter
          </Button>
          {playable.length === 0 ? (
            <Button
              onClick={() => selectTeam(FEATURED_TEAM_ID)}
              data-testid="switch-to-featured"
            >
              Switch to the featured club
            </Button>
          ) : null}
        </>
      }
    >
      <div className="stack">
        <section className="panel">
          <div className="team-panel__head">
            <Emblem team={team} size="large" />
            <div>
              <p className="panel__eyebrow">{team.location}, Tasmania</p>
              <h2 className="panel__title">{team.name}</h2>
              <div className="row row--wrap" style={{ marginTop: 'var(--space-2)' }}>
                <span className={`badge${featured ? ' badge--featured' : ''}`}>
                  {featured ? 'Featured club' : 'Roster in Stage 2'}
                </span>
                <span className="badge">{team.strength}</span>
                <span className="badge">{roster.length} fighters</span>
              </div>
            </div>
          </div>

          <p className="text-small muted" style={{ marginTop: 'var(--space-4)' }}>
            {team.description}
          </p>

          <dl className="team-panel__facts">
            <dt>Style</dt>
            <dd>{team.style}</dd>
            <dt>Speciality</dt>
            <dd>{team.speciality}</dd>
            <dt>Character</dt>
            <dd>{team.personality}</dd>
          </dl>
        </section>

        {playable.length === 0 ? (
          <section className="panel" data-testid="placeholder-roster-notice">
            <p className="panel__eyebrow">Stage 1 limitation</p>
            <h2 className="panel__title">This club’s fighters are not authored yet</h2>
            <p className="text-small muted">
              {team.name} has a complete club identity, and its six roster slots exist so that the data
              and navigation can be tested end to end. The fighters themselves — names, biographies,
              ratings and abilities — are authored in Stage 2. To play the training session now, switch
              to the featured club.
            </p>
          </section>
        ) : null}

        <section aria-labelledby="roster-heading">
          <h2 id="roster-heading" className="panel__title" style={{ marginBottom: 'var(--space-4)' }}>
            Roster
          </h2>
          <ul className="roster-grid" data-testid="team-roster">
            {roster.map((fighter) => (
              <li key={fighter.id} className="panel" style={{ padding: 'var(--space-4)' }}>
                <div className="fighter-card__head">
                  <div className="fighter-card__portrait">
                    <Portrait fighter={fighter} compact />
                  </div>
                  <div>
                    <p className="fighter-card__name">{fighter.name}</p>
                    <p className="fighter-card__role">{fighter.role}</p>
                    {fighter.relationship ? (
                      <p className="fighter-card__role">{fighter.relationship}</p>
                    ) : null}
                  </div>
                </div>
                <div className="row row--wrap" style={{ marginTop: 'var(--space-3)' }}>
                  {fighter.ageClassification === 'junior' ? (
                    <span className="badge badge--junior">Junior class</span>
                  ) : null}
                  {fighter.isPlaceholder ? (
                    <span className="badge badge--placeholder">Placeholder</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ScreenFrame>
  );
}
