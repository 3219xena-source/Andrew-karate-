/**
 * First tournament match — Stage 1 placeholder.
 *
 * This screen exists to make the unlock real and inspectable without pretending
 * a match mode has been built. It states exactly what is not implemented.
 */

import { Button } from '../components/ui/Button.tsx';
import { ScreenFrame } from '../components/ui/ScreenFrame.tsx';
import { getTeam } from '../data/teams.ts';
import { selectSelectedFighter, useGameStore } from '../state/gameStore.ts';

const STAGE_2_SCOPE: ReadonlyArray<{ title: string; detail: string }> = [
  { title: 'First opponent', detail: 'A second fighter driven by the same combat engine struct.' },
  { title: 'Opponent AI', detail: 'Distance keeping, technique selection and reaction timing.' },
  { title: 'Match scoring', detail: 'Point awards for clean scoring techniques, with a visible tally.' },
  { title: 'Round timer', detail: 'Timed rounds with a between-round reset to the marks.' },
  { title: 'Referee system', detail: 'Contact control, out-of-area calls and restart procedure.' },
  { title: 'Tournament bracket', detail: 'Six clubs, seeded draw, progression between matches.' },
  { title: 'Victory and defeat', detail: 'Result screens, a respectful bow-out, and saved match records.' },
  { title: 'Difficulty balancing', detail: 'Tuning passes across the AI and the rating-derived handling.' },
];

export function TournamentPlaceholderScreen() {
  const unlocked = useGameStore((state) => state.progress.firstTournamentUnlocked);
  const teamId = useGameStore((state) => state.progress.selectedTeamId);
  const fighter = useGameStore(selectSelectedFighter);
  const goToScreen = useGameStore((state) => state.goToScreen);
  const team = getTeam(teamId);

  if (!unlocked) {
    return (
      <ScreenFrame eyebrow="Tournament" title="First match">
        <div className="state-block">
          <h2 className="state-block__title">The first match is still locked</h2>
          <p className="state-block__body">
            Complete the training session in the dojo to unlock the first tournament match.
          </p>
          <Button variant="primary" onClick={() => goToScreen('dojo')}>
            Back to the dojo
          </Button>
        </div>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame
      eyebrow="Tournament · Round one"
      title="First match — placeholder"
      footer={
        <Button variant="ghost" sound="menu-back" onClick={() => goToScreen('stage-complete')}>
          Back
        </Button>
      }
    >
      <div className="completion">
        <section className="panel" data-testid="tournament-placeholder">
          <span className="badge badge--placeholder">Not implemented in Stage 1</span>
          <h2 className="panel__title" style={{ marginTop: 'var(--space-3)' }}>
            {team && fighter
              ? `${fighter.name} of ${team.name} is entered in round one`
              : 'Your fighter is entered in round one'}
          </h2>
          <p className="text-small muted" style={{ marginTop: 'var(--space-3)' }}>
            This unlock is a placeholder. There is no opponent, no scoring and no match to play yet —
            Stage 1 built the training prototype only, and inventing a fake match here would misrepresent
            what has been delivered. The list below is the Stage 2 scope that turns this into a real
            match.
          </p>
        </section>

        <section className="panel" aria-labelledby="stage2-heading">
          <h2 className="panel__title" id="stage2-heading">
            Stage 2 scope
          </h2>
          <ul className="stack stack--tight" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {STAGE_2_SCOPE.map((item) => (
              <li key={item.title} className="text-small">
                <strong>{item.title}</strong> — <span className="muted">{item.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ScreenFrame>
  );
}
