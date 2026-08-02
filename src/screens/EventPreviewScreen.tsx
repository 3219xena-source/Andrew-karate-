/**
 * Event preview — the venue, the opponent club and the full bout order.
 *
 * Shown before the first bout of an event, and again whenever the player
 * returns to a partly-played event. The bout order comes from the live event
 * controller, so what is listed here is exactly what will be fought.
 */

import { Button } from '../components/ui/Button.tsx';
import { Emblem } from '../components/ui/Emblem.tsx';
import { Portrait } from '../components/ui/Portrait.tsx';
import { ScreenFrame } from '../components/ui/ScreenFrame.tsx';
import { getTeam } from '../data/teams.ts';
import { WEIGHT_CLASS_LABELS } from '../types/fighter.ts';
import {
  getEventController,
  selectActiveEvent,
  selectVenueForEvent,
  useGameStore,
} from '../state/gameStore.ts';

export function EventPreviewScreen() {
  const goToScreen = useGameStore((state) => state.goToScreen);
  const beginNextBout = useGameStore((state) => state.beginNextBout);
  const event = useGameStore(selectActiveEvent);
  const venue = selectVenueForEvent(event);
  const controller = getEventController();

  if (!event || !venue || !controller) {
    return (
      <ScreenFrame eyebrow="Competition" title="Event">
        <div className="state-block" role="alert">
          <h2 className="state-block__title">No event is open</h2>
          <p className="state-block__body">Return to the season and choose the next event.</p>
          <Button variant="primary" onClick={() => goToScreen('season')}>
            Back to the season
          </Button>
        </div>
      </ScreenFrame>
    );
  }

  const pairings = controller.getPairings();
  const completed = controller.getCompletedBouts();
  const rejected = controller.getRejectedPairings();
  const playerTeam = getTeam(pairings[0]?.player.teamId);
  const opponentTeam = getTeam(pairings[0]?.opponent.teamId);
  const resuming = completed.length > 0;

  return (
    <ScreenFrame
      eyebrow={`${venue.name} · ${venue.location}`}
      title={event.kind === 'championship' ? 'Tasmania Championship Final' : event.name}
      wide
      footer={
        <>
          <Button variant="ghost" sound="menu-back" onClick={() => goToScreen('season')} data-testid="event-back">
            Back to the season
          </Button>
          <Button variant="primary" onClick={beginNextBout} data-testid="start-event">
            {resuming ? 'Continue the tie' : 'Start the first bout'}
          </Button>
        </>
      }
    >
      <div className="event-layout">
        <section className="panel venue-panel" data-testid="venue-panel">
          <p className="panel__eyebrow">Venue</p>
          <h2 className="panel__title">{venue.name}</h2>
          <p className="text-small muted">{venue.description}</p>
          <p className="subtle" style={{ marginTop: 'var(--space-3)' }}>
            {venue.atmosphere} Capacity {venue.capacity.toLocaleString('en-AU')}.
          </p>
          <p className="subtle" style={{ marginTop: 'var(--space-2)' }}>
            A fictional venue inspired by {venue.location}.
          </p>
        </section>

        <section className="panel" data-testid="opponent-panel">
          <div className="row" style={{ gap: 'var(--space-4)' }}>
            {playerTeam ? <Emblem team={playerTeam} size="large" /> : null}
            <span className="versus-mark" aria-hidden="true">
              vs
            </span>
            {opponentTeam ? <Emblem team={opponentTeam} size="large" /> : null}
          </div>
          <h2 className="panel__title" style={{ marginTop: 'var(--space-3)' }}>
            {playerTeam?.shortName} versus {opponentTeam?.shortName}
          </h2>
          <p className="text-small muted">{opponentTeam?.description}</p>
          <dl className="team-panel__facts">
            <dt>Coach</dt>
            <dd>{opponentTeam?.coach}</dd>
            <dt>Style</dt>
            <dd>{opponentTeam?.style}</dd>
            <dt>Strength</dt>
            <dd>{opponentTeam?.strength}</dd>
            <dt>Format</dt>
            <dd>Six bouts, best of three rounds each. First club to four bouts wins the tie.</dd>
          </dl>
          {resuming ? (
            <p className="subtle" data-testid="resume-notice">
              Tie in progress: {controller.getPlayerScore()}–{controller.getOpponentScore()} after{' '}
              {completed.length} {completed.length === 1 ? 'bout' : 'bouts'}.
            </p>
          ) : null}
        </section>

        <section aria-labelledby="order-heading" className="event-order">
          <h2 id="order-heading" className="panel__title" style={{ marginBottom: 'var(--space-4)' }}>
            Bout order
          </h2>
          {rejected.length > 0 ? (
            <p className="notice notice--warning" role="alert">
              {rejected.length} scheduled pairing(s) failed the competition-class check and have been
              withdrawn. This indicates a content error, not a player action.
            </p>
          ) : null}
          <ol className="bout-order" data-testid="bout-order">
            {pairings.map((pairing) => {
              const result = completed.find((bout) => bout.index === pairing.index);
              return (
                <li
                  key={pairing.index}
                  className={`bout-order__item${result ? ' bout-order__item--done' : ''}`}
                  data-testid={`bout-row-${pairing.index}`}
                >
                  <span className="bout-order__number">{pairing.index + 1}</span>
                  <div className="bout-order__side">
                    <div className="bout-order__portrait">
                      <Portrait fighter={pairing.player} compact />
                    </div>
                    <div>
                      <p className="fighter-card__name">{pairing.player.name}</p>
                      <p className="fighter-card__role">{pairing.player.fightingStyle}</p>
                    </div>
                  </div>
                  <div className="bout-order__meta">
                    <span className="badge">
                      {pairing.player.ageClassification === 'junior' ? 'Junior' : 'Open'}
                    </span>
                    <span className="badge">{WEIGHT_CLASS_LABELS[pairing.player.weightClass]}</span>
                    {result ? (
                      <span
                        className={`badge ${result.winner === 'player' ? 'badge--featured' : 'badge--placeholder'}`}
                      >
                        {result.winner === 'player' ? 'Won' : 'Lost'} {result.playerRounds}–
                        {result.opponentRounds}
                      </span>
                    ) : null}
                  </div>
                  <div className="bout-order__side bout-order__side--right">
                    <div>
                      <p className="fighter-card__name">{pairing.opponent.name}</p>
                      <p className="fighter-card__role">{pairing.opponent.fightingStyle}</p>
                    </div>
                    <div className="bout-order__portrait">
                      <Portrait fighter={pairing.opponent} compact />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="subtle" style={{ marginTop: 'var(--space-3)' }}>
            Fighters are paired by squad position, so juniors always meet juniors and no bout crosses
            more than one weight division. If the tie finishes 3–3, each club nominates its
            highest-rated open-division competitor for a deciding seventh bout.
          </p>
        </section>
      </div>
    </ScreenFrame>
  );
}
