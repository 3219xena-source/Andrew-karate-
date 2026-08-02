/**
 * Stage 1 completion screen.
 *
 * Confirms what the player achieved, states plainly what has been unlocked, and
 * offers replay and reset controls. It also names the placeholder status of the
 * tournament so the unlock is not mistaken for a finished match mode.
 */

import { Button } from '../components/ui/Button.tsx';
import { Emblem } from '../components/ui/Emblem.tsx';
import { Portrait } from '../components/ui/Portrait.tsx';
import { ScreenFrame } from '../components/ui/ScreenFrame.tsx';
import { TUTORIAL_OBJECTIVES } from '../data/tutorial.ts';
import { getTeam } from '../data/teams.ts';
import { selectSelectedFighter, useGameStore } from '../state/gameStore.ts';

export function StageCompleteScreen() {
  const fighter = useGameStore(selectSelectedFighter);
  const teamId = useGameStore((state) => state.progress.selectedTeamId);
  const unlocked = useGameStore((state) => state.progress.firstTournamentUnlocked);
  const completedCount = useGameStore((state) => state.progress.completedObjectiveIds.length);
  const goToScreen = useGameStore((state) => state.goToScreen);
  const restartTutorial = useGameStore((state) => state.restartTutorial);

  const team = getTeam(teamId);

  return (
    <ScreenFrame
      eyebrow="Stage 1"
      title="Training session complete"
      footer={
        <>
          <Button variant="ghost" sound="menu-back" onClick={() => goToScreen('title')}>
            Title screen
          </Button>
          <Button onClick={restartTutorial} data-testid="replay-training">
            Replay training
          </Button>
          <Button
            variant="primary"
            onClick={() => goToScreen('tournament')}
            disabled={!unlocked}
            data-testid="enter-tournament"
          >
            First tournament match
          </Button>
        </>
      }
    >
      <div className="completion animate-rise">
        <section className="panel" data-testid="stage-complete-panel">
          <p className="panel__eyebrow">Stage 1 complete</p>
          <h2 className="panel__title">
            {fighter ? `${fighter.name} has completed the dojo session` : 'The dojo session is complete'}
          </h2>
          <p className="text-small muted" style={{ marginTop: 'var(--space-3)' }}>
            Movement, light and strong technique, guard, evasion, combination work, stamina management
            and the closing bow have all been demonstrated. The coach has signed the session off, and
            your progress is saved in this browser.
          </p>

          <div className="row row--wrap" style={{ marginTop: 'var(--space-4)', gap: 'var(--space-4)' }}>
            {team ? (
              <div className="row">
                <Emblem team={team} />
                <div>
                  <p className="text-small">{team.name}</p>
                  <p className="subtle">{team.location}, Tasmania</p>
                </div>
              </div>
            ) : null}
            {fighter ? (
              <div className="row">
                <div style={{ width: '3rem' }}>
                  <Portrait fighter={fighter} compact />
                </div>
                <div>
                  <p className="text-small">{fighter.name}</p>
                  <p className="subtle">{fighter.fightingStyle}</p>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <div className="completion__summary">
          <div className="completion__stat">
            <p className="completion__stat-value">
              {completedCount}/{TUTORIAL_OBJECTIVES.length}
            </p>
            <p className="completion__stat-label">Objectives completed</p>
          </div>
          <div className="completion__stat">
            <p className="completion__stat-value" data-testid="tournament-unlock-state">
              {unlocked ? 'Unlocked' : 'Locked'}
            </p>
            <p className="completion__stat-label">First tournament match</p>
          </div>
          <div className="completion__stat">
            <p className="completion__stat-value">Saved</p>
            <p className="completion__stat-label">Progress in this browser</p>
          </div>
        </div>

        <section className="panel">
          <p className="panel__eyebrow">What happens next</p>
          <h2 className="panel__title">Stage 2 — the first opponent</h2>
          <p className="text-small muted">
            The first tournament match is unlocked as a <strong>placeholder</strong>. Stage 2 adds the
            opponent, basic opponent AI, round timing, referee rules and scoring; Stage 1 deliberately
            does not include them. Selecting the tournament now opens a summary of what is coming rather
            than a playable match.
          </p>
        </section>
      </div>
    </ScreenFrame>
  );
}
