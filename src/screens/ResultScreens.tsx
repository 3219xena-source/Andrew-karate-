/**
 * The competition result screens: versus, bout result, event result,
 * standings, championship qualification, season completion and credits.
 *
 * They are grouped in one file because they share the same presentational
 * vocabulary and none of them owns any game logic — every value shown is read
 * from the season state or the live event controller.
 */

import { Button } from '../components/ui/Button.tsx';
import { Emblem } from '../components/ui/Emblem.tsx';
import { Portrait } from '../components/ui/Portrait.tsx';
import { ScreenFrame } from '../components/ui/ScreenFrame.tsx';
import { StandingsTable } from '../components/season/StandingsTable.tsx';
import { StatBar } from '../components/ui/StatBar.tsx';
import { FIGHTERS, getRoster } from '../data/fighters.ts';
import { getTeam } from '../data/teams.ts';
import { STAT_KEYS, STAT_LABELS, WEIGHT_CLASS_LABELS } from '../types/fighter.ts';
import {
  getEventController,
  selectActiveEvent,
  selectPlayerPosition,
  selectQualifiedOnMerit,
  selectVenueForEvent,
  useGameStore,
} from '../state/gameStore.ts';
import { ordinal } from './SeasonHubScreen.tsx';

// ── Versus ───────────────────────────────────────────────────────────────────

export function VersusScreen() {
  const activeBout = useGameStore((state) => state.activeBout);
  const goToScreen = useGameStore((state) => state.goToScreen);
  const event = useGameStore(selectActiveEvent);
  const venue = selectVenueForEvent(event);
  const controller = getEventController();

  if (!activeBout) {
    return (
      <ScreenFrame eyebrow="Competition" title="Next bout">
        <div className="state-block" role="alert">
          <h2 className="state-block__title">No bout is scheduled</h2>
          <Button variant="primary" onClick={() => goToScreen('season')}>
            Back to the season
          </Button>
        </div>
      </ScreenFrame>
    );
  }

  const { playerFighter, opponentFighter } = activeBout;
  const playerTeam = getTeam(playerFighter.teamId);
  const opponentTeam = getTeam(opponentFighter.teamId);

  return (
    <ScreenFrame
      eyebrow={`${venue?.name ?? 'Arena'} · ${
        activeBout.isTieBreaker ? 'Deciding bout' : `Bout ${activeBout.index + 1} of 6`
      }`}
      title="Next bout"
      wide
      footer={
        <>
          <Button
            variant="ghost"
            sound="menu-back"
            onClick={() => goToScreen('event-preview')}
            data-testid="versus-back"
          >
            Bout order
          </Button>
          <Button variant="primary" onClick={() => goToScreen('fight')} data-testid="begin-bout">
            Fight
          </Button>
        </>
      }
    >
      <div className="versus animate-rise" data-testid="versus-panel">
        <VersusSide fighter={playerFighter} team={playerTeam} side="left" />
        <div className="versus__centre">
          <p className="versus__mark" aria-hidden="true">
            VS
          </p>
          <p className="subtle">
            {playerFighter.ageClassification === 'junior' ? 'Junior division' : 'Open division'} ·{' '}
            {WEIGHT_CLASS_LABELS[playerFighter.weightClass]}
          </p>
          {controller ? (
            <p className="versus__score" data-testid="versus-score">
              {controller.getPlayerScore()} — {controller.getOpponentScore()}
            </p>
          ) : null}
          <p className="subtle">Best of three rounds</p>
        </div>
        <VersusSide fighter={opponentFighter} team={opponentTeam} side="right" />
      </div>
    </ScreenFrame>
  );
}

function VersusSide({
  fighter,
  team,
  side,
}: {
  readonly fighter: (typeof FIGHTERS)[number];
  readonly team: ReturnType<typeof getTeam>;
  readonly side: 'left' | 'right';
}) {
  return (
    <section className={`versus__side versus__side--${side}`}>
      <div className="versus__portrait">
        <Portrait fighter={fighter} />
      </div>
      <div className="row" style={{ justifyContent: side === 'right' ? 'flex-end' : 'flex-start' }}>
        {team ? <Emblem team={team} /> : null}
        <div>
          <h2 className="panel__title">{fighter.name}</h2>
          <p className="subtle">{team?.name}</p>
        </div>
      </div>
      <p className="text-small muted">{fighter.fightingStyle}</p>
      <div className="fighter-profile__stats">
        {STAT_KEYS.map((key) => (
          <StatBar key={key} label={STAT_LABELS[key]} value={fighter.stats[key]} />
        ))}
      </div>
      <div className="ability">
        <p className="ability__name">Signature · {fighter.specialAbility.name}</p>
        <p className="text-small muted">{fighter.specialAbility.description}</p>
      </div>
    </section>
  );
}

// ── Bout result ──────────────────────────────────────────────────────────────

export function BoutResultScreen() {
  const result = useGameStore((state) => state.lastBoutResult);
  const continueAfterBout = useGameStore((state) => state.continueAfterBout);
  const goToScreen = useGameStore((state) => state.goToScreen);
  const controller = getEventController();

  if (!result) {
    return (
      <ScreenFrame eyebrow="Competition" title="Bout result">
        <div className="state-block" role="alert">
          <h2 className="state-block__title">No bout result to show</h2>
          <Button variant="primary" onClick={() => goToScreen('season')}>
            Back to the season
          </Button>
        </div>
      </ScreenFrame>
    );
  }

  const playerFighter = FIGHTERS.find((fighter) => fighter.id === result.playerFighterId);
  const opponentFighter = FIGHTERS.find((fighter) => fighter.id === result.opponentFighterId);
  const won = result.winner === 'player';
  const eventDecided = controller?.isComplete() ?? true;
  const nextPairing = controller?.getNextPairing() ?? null;

  return (
    <ScreenFrame
      eyebrow={won ? 'Bout won' : 'Bout lost'}
      title={won ? `${playerFighter?.name ?? 'Your fighter'} takes the bout` : `${opponentFighter?.name ?? 'The opponent'} takes the bout`}
      footer={
        <Button variant="primary" onClick={continueAfterBout} data-testid="continue-after-bout">
          {eventDecided ? 'See the tie result' : 'Next fighter'}
        </Button>
      }
    >
      <div className="completion animate-rise">
        <section className="panel" data-testid="bout-result-panel">
          <p className="panel__eyebrow">{result.isTieBreaker ? 'Deciding bout' : `Bout ${result.index + 1}`}</p>
          <h2 className="panel__title">
            {result.playerRounds}–{result.opponentRounds} on rounds ·{' '}
            {result.endReason === 'knockout'
              ? 'Referee stopped the round'
              : result.endReason === 'timeout'
                ? 'Decided on the clock'
                : 'Drawn round'}
          </h2>
          {controller ? (
            <p className="text-small muted" style={{ marginTop: 'var(--space-3)' }} data-testid="running-score">
              Tie score: {controller.getPlayerScore()} — {controller.getOpponentScore()}
              {nextPairing
                ? `. Next: ${nextPairing.player.name} versus ${nextPairing.opponent.name}.`
                : '.'}
            </p>
          ) : null}
        </section>

        <div className="completion__summary">
          <ResultStat label="Damage dealt" value={result.stats.damageDealt} />
          <ResultStat label="Damage taken" value={result.stats.damageTaken} />
          <ResultStat label="Punches landed" value={result.stats.punchesLanded} />
          <ResultStat label="Kicks landed" value={result.stats.kicksLanded} />
          <ResultStat label="Attacks blocked" value={result.stats.attacksBlocked} />
          <ResultStat label="Dodges" value={result.stats.dodgesSucceeded} />
          <ResultStat label="Power moves" value={result.stats.powerMovesUsed} />
          <ResultStat label="Strong attacks" value={result.stats.strongAttacksLanded} />
        </div>
      </div>
    </ScreenFrame>
  );
}

function ResultStat({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="completion__stat">
      <p className="completion__stat-value">{value}</p>
      <p className="completion__stat-label">{label}</p>
    </div>
  );
}

// ── Event result ─────────────────────────────────────────────────────────────

export function EventResultScreen() {
  const result = useGameStore((state) => state.lastEventResult);
  const season = useGameStore((state) => state.season);
  const goToScreen = useGameStore((state) => state.goToScreen);

  if (!result || !season) {
    return (
      <ScreenFrame eyebrow="Competition" title="Event result">
        <div className="state-block" role="alert">
          <h2 className="state-block__title">No event result to show</h2>
          <Button variant="primary" onClick={() => goToScreen('season')}>
            Back to the season
          </Button>
        </div>
      </ScreenFrame>
    );
  }

  const playerTeam = getTeam(result.playerTeamId);
  const opponentTeam = getTeam(result.opponentTeamId);
  const won = result.winner === 'player';
  const isFinal = result.eventId.endsWith('-final');
  const leaguePlayed = season.results.filter((entry) => !entry.eventId.endsWith('-final')).length;
  const nextScreen = isFinal
    ? 'season-complete'
    : leaguePlayed >= 5
      ? 'championship-qualification'
      : 'season';

  return (
    <ScreenFrame
      eyebrow={won ? 'Tie won' : 'Tie lost'}
      title={`${playerTeam?.shortName} ${result.playerBoutWins} — ${result.opponentBoutWins} ${opponentTeam?.shortName}`}
      footer={
        <Button
          variant="primary"
          onClick={() => goToScreen(nextScreen as never)}
          data-testid="continue-after-event"
        >
          {isFinal ? 'Season summary' : leaguePlayed >= 5 ? 'Championship qualification' : 'Back to the season'}
        </Button>
      }
    >
      <div className="completion animate-rise">
        <section className="panel" data-testid="event-result-panel">
          <p className="panel__eyebrow">{isFinal ? 'Championship final' : 'League round'}</p>
          <h2 className="panel__title">
            {won ? `${playerTeam?.name} win the tie` : `${opponentTeam?.name} win the tie`}
          </h2>
          <p className="text-small muted" style={{ marginTop: 'var(--space-3)' }}>
            {result.decidedByTieBreaker
              ? 'The six scheduled bouts finished level at 3–3, so the tie was settled by a deciding seventh bout between each club’s highest-rated open-division competitor.'
              : `Decided over ${result.bouts.length} ${result.bouts.length === 1 ? 'bout' : 'bouts'}.`}
          </p>
        </section>

        <section className="panel">
          <h2 className="panel__title" style={{ marginBottom: 'var(--space-3)' }}>
            Bout by bout
          </h2>
          <ol className="bout-summary" data-testid="event-bout-summary">
            {result.bouts.map((bout) => {
              const player = FIGHTERS.find((fighter) => fighter.id === bout.playerFighterId);
              const opponent = FIGHTERS.find((fighter) => fighter.id === bout.opponentFighterId);
              return (
                <li key={bout.index} className="bout-summary__row">
                  <span className="bout-summary__index">
                    {bout.isTieBreaker ? 'Decider' : bout.index + 1}
                  </span>
                  <span>{player?.name ?? bout.playerFighterId}</span>
                  <span
                    className={`badge ${bout.winner === 'player' ? 'badge--featured' : 'badge--placeholder'}`}
                  >
                    {bout.playerRounds}–{bout.opponentRounds}
                  </span>
                  <span>{opponent?.name ?? bout.opponentFighterId}</span>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="panel">
          <h2 className="panel__title" style={{ marginBottom: 'var(--space-3)' }}>
            Standings
          </h2>
          <StandingsTable standings={season.standings} playerTeamId={season.playerTeamId} />
        </section>
      </div>
    </ScreenFrame>
  );
}

// ── Standings ────────────────────────────────────────────────────────────────

export function StandingsScreen() {
  const season = useGameStore((state) => state.season);
  const goToScreen = useGameStore((state) => state.goToScreen);
  const position = useGameStore(selectPlayerPosition);

  if (!season) {
    return (
      <ScreenFrame eyebrow="Championship" title="Standings">
        <div className="state-block" role="alert">
          <h2 className="state-block__title">No season is running</h2>
          <Button variant="primary" onClick={() => goToScreen('club-select')}>
            Choose a club
          </Button>
        </div>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame
      eyebrow="Championship"
      title="Season standings"
      footer={
        <Button
          variant="primary"
          sound="menu-back"
          onClick={() => goToScreen('season')}
          data-testid="back-to-season"
        >
          Back to the season
        </Button>
      }
    >
      <div className="completion">
        <section className="panel">
          <StandingsTable standings={season.standings} playerTeamId={season.playerTeamId} />
          <p className="subtle" style={{ marginTop: 'var(--space-4)' }}>
            Three points for a tie win, none for a loss. Clubs level on points are separated by bout
            difference, then by bouts won.
          </p>
          <p className="subtle" style={{ marginTop: 'var(--space-2)' }} data-testid="simulation-note">
            Your club’s results come from bouts you fought. Ties between the four clubs not facing you
            in a given round are resolved by a deterministic strength model rather than played out.
          </p>
          {position > 0 ? (
            <p className="text-small" style={{ marginTop: 'var(--space-3)' }}>
              Your club is currently <strong>{ordinal(position)}</strong>.
            </p>
          ) : null}
        </section>
      </div>
    </ScreenFrame>
  );
}

// ── Championship qualification ───────────────────────────────────────────────

export function ChampionshipQualificationScreen() {
  const season = useGameStore((state) => state.season);
  const goToScreen = useGameStore((state) => state.goToScreen);
  const openEvent = useGameStore((state) => state.openEvent);
  const onMerit = useGameStore(selectQualifiedOnMerit);
  const position = useGameStore(selectPlayerPosition);

  if (!season) {
    return (
      <ScreenFrame eyebrow="Championship" title="Qualification">
        <div className="state-block" role="alert">
          <h2 className="state-block__title">No season is running</h2>
          <Button variant="primary" onClick={() => goToScreen('club-select')}>
            Choose a club
          </Button>
        </div>
      </ScreenFrame>
    );
  }

  const final = season.events.find((event) => event.kind === 'championship');
  const opponent = getTeam(season.championshipOpponentId);
  const club = getTeam(season.playerTeamId);

  return (
    <ScreenFrame
      eyebrow="League complete"
      title="Championship qualification"
      footer={
        <>
          <Button variant="ghost" sound="menu-back" onClick={() => goToScreen('season')}>
            Season schedule
          </Button>
          {final ? (
            <Button
              variant="primary"
              onClick={() => openEvent(final.id)}
              data-testid="enter-championship"
            >
              Enter the final
            </Button>
          ) : null}
        </>
      }
    >
      <div className="completion animate-rise">
        <section className="panel" data-testid="qualification-panel">
          <p className="panel__eyebrow">Final</p>
          <h2 className="panel__title">
            {club?.name} meet {opponent?.name ?? 'the leading rival'} for the championship
          </h2>
          <p className="text-small muted" style={{ marginTop: 'var(--space-3)' }}>
            {onMerit
              ? `Your club finished ${ordinal(position)} in the league and reached the final on merit.`
              : `Your club finished ${ordinal(position)}. Under this season's format the host club is seeded into the final, so you contest it as the host rather than on league position.`}
          </p>
          <p className="subtle" style={{ marginTop: 'var(--space-3)' }} data-testid="qualification-rule">
            Format: the standings decide who you face in the final. The host club is always seeded in,
            so the season can always be completed.
          </p>
        </section>

        <section className="panel">
          <h2 className="panel__title" style={{ marginBottom: 'var(--space-3)' }}>
            Final standings after the league
          </h2>
          <StandingsTable standings={season.standings} playerTeamId={season.playerTeamId} />
        </section>
      </div>
    </ScreenFrame>
  );
}

// ── Season complete ──────────────────────────────────────────────────────────

export function SeasonCompleteScreen() {
  const season = useGameStore((state) => state.season);
  const goToScreen = useGameStore((state) => state.goToScreen);
  const startNewSeason = useGameStore((state) => state.startNewSeason);

  if (!season) {
    return (
      <ScreenFrame eyebrow="Championship" title="Season complete">
        <div className="state-block" role="alert">
          <h2 className="state-block__title">No season to summarise</h2>
          <Button variant="primary" onClick={() => goToScreen('club-select')}>
            Choose a club
          </Button>
        </div>
      </ScreenFrame>
    );
  }

  const club = getTeam(season.playerTeamId);
  const won = season.championshipWon === true;
  const final = season.results.find((result) => result.eventId.endsWith('-final'));
  const league = season.results.filter((result) => !result.eventId.endsWith('-final'));
  const leagueWins = league.filter((result) => result.winner === 'player').length;
  const totalBouts = season.results.reduce((sum, result) => sum + result.bouts.length, 0);
  const boutWins = season.results.reduce((sum, result) => sum + result.playerBoutWins, 0);

  return (
    <ScreenFrame
      eyebrow="Season complete"
      title={won ? 'Tasmania Champions' : 'Season complete'}
      footer={
        <>
          <Button variant="ghost" sound="menu-back" onClick={() => goToScreen('title')}>
            Title screen
          </Button>
          <Button onClick={() => goToScreen('credits')} data-testid="view-credits">
            Credits
          </Button>
          <Button variant="primary" onClick={startNewSeason} data-testid="new-season">
            Start a new season
          </Button>
        </>
      }
    >
      <div className="completion animate-rise">
        <section className="panel" data-testid="season-complete-panel">
          <p className="panel__eyebrow">{won ? 'Champions' : 'Runners-up'}</p>
          <h2 className="panel__title">
            {won
              ? `${club?.name} win the Tasmania Championship`
              : `${club?.name} finish the season as runners-up`}
          </h2>
          <p className="text-small muted" style={{ marginTop: 'var(--space-3)' }}>
            {final
              ? `The final finished ${final.playerBoutWins}–${final.opponentBoutWins}${
                  final.decidedByTieBreaker ? ' after a deciding bout' : ''
                }.`
              : 'The final has not been recorded.'}
          </p>
          {club ? (
            <div className="row" style={{ marginTop: 'var(--space-4)' }}>
              <Emblem team={club} size="large" />
              <div>
                <p className="text-small">{club.name}</p>
                <p className="subtle">Coach {club.coach}</p>
              </div>
            </div>
          ) : null}
        </section>

        <div className="completion__summary">
          <ResultStat label="League ties won" value={leagueWins} />
          <ResultStat label="Bouts contested" value={totalBouts} />
          <ResultStat label="Bouts won" value={boutWins} />
        </div>

        <section className="panel">
          <h2 className="panel__title" style={{ marginBottom: 'var(--space-3)' }}>
            Final standings
          </h2>
          <StandingsTable standings={season.standings} playerTeamId={season.playerTeamId} />
        </section>
      </div>
    </ScreenFrame>
  );
}

// ── Credits ──────────────────────────────────────────────────────────────────

export function CreditsScreen() {
  const goToScreen = useGameStore((state) => state.goToScreen);
  const clubCount = new Set(FIGHTERS.map((fighter) => fighter.teamId)).size;

  return (
    <ScreenFrame
      eyebrow="About"
      title="Credits and licensing"
      footer={
        <Button variant="primary" sound="menu-back" onClick={() => goToScreen('title')}>
          Back
        </Button>
      }
    >
      <div className="completion">
        <section className="panel">
          <p className="panel__eyebrow">Content</p>
          <h2 className="panel__title">Tasmania Martial Arts Championship</h2>
          <p className="text-small muted">
            {clubCount} clubs, {FIGHTERS.length} fighters, six venues and a six-event season. Every
            club, character, coach and venue in this game is fictional.
          </p>
        </section>

        <section className="panel">
          <p className="panel__eyebrow">Assets</p>
          <h2 className="panel__title">All original, all generated at runtime</h2>
          <ul className="stack stack--tight text-small muted" style={{ paddingLeft: '1.1rem' }}>
            <li>Music and every sound effect are synthesised by the game with the Web Audio API.</li>
            <li>The Tasmania map is an original stylised vector, not derived from map data.</li>
            <li>Arenas, crowds, banners, fighters and portraits are drawn procedurally.</li>
            <li>Typography uses the operating system’s own fonts. Nothing is downloaded.</li>
          </ul>
          <p className="subtle" style={{ marginTop: 'var(--space-3)' }}>
            There are no image, audio or font files in this project. Full detail is in the asset
            register.
          </p>
        </section>

        <section className="panel">
          <p className="panel__eyebrow">Characters</p>
          <h2 className="panel__title">Fictionalised game avatars</h2>
          <p className="text-small muted">
            Every character is a fictionalised game avatar. Names, biographies, ratings, ages and
            appearances are game content only, and do not describe the real appearance, ability,
            health, personality or history of any real person.
          </p>
        </section>

        <section className="panel">
          <p className="panel__eyebrow">Competition rules</p>
          <h2 className="panel__title">Fictional arcade rules</h2>
          <p className="text-small muted">
            The competition format, scoring, weight divisions and tie-breakers in this game are
            fictional arcade rules written for it. They are not the regulations of any real karate or
            kung-fu sanctioning body. Junior competitors only ever face other juniors.
          </p>
        </section>
      </div>
    </ScreenFrame>
  );
}

/** Re-exported for the roster preview panel used on the event screens. */
export { getRoster };
