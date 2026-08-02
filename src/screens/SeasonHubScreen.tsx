/**
 * Season hub — the schedule, the standings, and the way into the next event.
 *
 * This is the screen the player returns to between events. It shows the six
 * scheduled events with their real status, the live league table, and the
 * player's club record.
 */

import { Button } from '../components/ui/Button.tsx';
import { Emblem } from '../components/ui/Emblem.tsx';
import { ScreenFrame } from '../components/ui/ScreenFrame.tsx';
import { StandingsTable } from '../components/season/StandingsTable.tsx';
import { getTeam } from '../data/teams.ts';
import { getVenue } from '../data/venues.ts';
import { eventStatus } from '../systems/season/seasonEngine.ts';
import { selectPlayerPosition, useGameStore } from '../state/gameStore.ts';

export function SeasonHubScreen() {
  const season = useGameStore((state) => state.season);
  const openEvent = useGameStore((state) => state.openEvent);
  const goToScreen = useGameStore((state) => state.goToScreen);
  const position = useGameStore(selectPlayerPosition);

  if (!season) {
    return (
      <ScreenFrame eyebrow="Championship" title="Season">
        <div className="state-block" role="alert">
          <h2 className="state-block__title">No season is running</h2>
          <p className="state-block__body">
            Choose a club and start a season to see the schedule and the standings.
          </p>
          <Button variant="primary" onClick={() => goToScreen('club-select')}>
            Choose a club
          </Button>
        </div>
      </ScreenFrame>
    );
  }

  const club = getTeam(season.playerTeamId);
  const played = season.results.filter((result) => !result.eventId.endsWith('-final'));
  const wins = played.filter((result) => result.winner === 'player').length;

  return (
    <ScreenFrame
      eyebrow={`${club?.name ?? 'Your club'} · Season`}
      title="Tasmania Championship season"
      wide
      footer={
        <>
          <Button variant="ghost" sound="menu-back" onClick={() => goToScreen('title')}>
            Title screen
          </Button>
          <Button onClick={() => goToScreen('standings')} data-testid="view-standings">
            Full standings
          </Button>
        </>
      }
    >
      <div className="season-layout">
        <section aria-labelledby="schedule-heading">
          <h2 id="schedule-heading" className="panel__title" style={{ marginBottom: 'var(--space-4)' }}>
            Schedule
          </h2>
          <ol className="schedule" data-testid="season-schedule">
            {season.events.map((event) => {
              const status = eventStatus(season, event);
              const opponent = getTeam(event.opponentTeamId ?? season.championshipOpponentId);
              const venue = getVenue(event.venueId);
              const result = season.results.find((entry) => entry.eventId === event.id);

              return (
                <li
                  key={event.id}
                  className={`schedule__item schedule__item--${status}`}
                  data-testid={`schedule-${event.round}`}
                  data-status={status}
                >
                  <span className="schedule__round" aria-hidden="true">
                    {event.round}
                  </span>
                  <div className="schedule__body">
                    <p className="schedule__name">
                      {event.kind === 'championship' ? 'Tasmania Championship Final' : event.name}
                    </p>
                    <p className="subtle">
                      {opponent ? `vs ${opponent.name}` : 'Opponent decided by the standings'} ·{' '}
                      {venue?.name ?? 'Venue to be confirmed'}, {event.location}
                    </p>
                    {result ? (
                      <p className="schedule__result" data-testid={`schedule-result-${event.round}`}>
                        {result.winner === 'player' ? 'Won' : 'Lost'} {result.playerBoutWins}–
                        {result.opponentBoutWins}
                        {result.decidedByTieBreaker ? ' (deciding bout)' : ''}
                      </p>
                    ) : null}
                  </div>
                  <div className="schedule__action">
                    <span className={`badge badge--${status}`}>{statusLabel(status)}</span>
                    {status === 'available' ? (
                      <Button
                        variant="primary"
                        onClick={() => openEvent(event.id)}
                        data-testid={`enter-event-${event.round}`}
                      >
                        {event.kind === 'championship' ? 'Enter the final' : 'Travel to event'}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <aside className="stack">
          <section className="panel">
            <div className="row">
              {club ? <Emblem team={club} size="large" /> : null}
              <div>
                <p className="panel__eyebrow">Your club</p>
                <h2 className="panel__title">{club?.name ?? 'Unknown club'}</h2>
                <p className="subtle">Coach {club?.coach ?? '—'}</p>
              </div>
            </div>
            <dl className="team-panel__facts">
              <dt>Events played</dt>
              <dd data-testid="events-played">{played.length} of 5</dd>
              <dt>Record</dt>
              <dd data-testid="club-record">
                {wins} won, {played.length - wins} lost
              </dd>
              <dt>League position</dt>
              <dd data-testid="league-position">{position > 0 ? `${ordinal(position)}` : '—'}</dd>
            </dl>
          </section>

          <section className="panel">
            <p className="panel__eyebrow">Table</p>
            <h2 className="panel__title">Standings</h2>
            <StandingsTable
              standings={season.standings}
              playerTeamId={season.playerTeamId}
              compact
            />
          </section>
        </aside>
      </div>
    </ScreenFrame>
  );
}

function statusLabel(status: 'locked' | 'available' | 'complete'): string {
  switch (status) {
    case 'available':
      return 'Next up';
    case 'complete':
      return 'Complete';
    default:
      return 'Locked';
  }
}

export function ordinal(value: number): string {
  const suffix =
    value % 10 === 1 && value % 100 !== 11
      ? 'st'
      : value % 10 === 2 && value % 100 !== 12
        ? 'nd'
        : value % 10 === 3 && value % 100 !== 13
          ? 'rd'
          : 'th';
  return `${value}${suffix}`;
}
