/**
 * Title screen — the entry point of the Stage 1 journey.
 *
 * Offers a new game, a continue option when the save justifies one, settings,
 * and the sound toggle. The first interaction here is also what unlocks the
 * audio context, which browsers require to come from a user gesture.
 */

import { CONTROL_GUIDE } from '../systems/input/inputManager.ts';
import { Button } from '../components/ui/Button.tsx';
import { ScreenFrame } from '../components/ui/ScreenFrame.tsx';
import {
  selectHasResumableProgress,
  selectTutorialCompletion,
  useGameStore,
} from '../state/gameStore.ts';

export function TitleScreen() {
  const startNewGame = useGameStore((state) => state.startNewGame);
  const continueGame = useGameStore((state) => state.continueGame);
  const openSettings = useGameStore((state) => state.openSettings);
  const canContinue = useGameStore(selectHasResumableProgress);
  const completion = useGameStore(selectTutorialCompletion);
  const stage1Complete = useGameStore((state) => state.progress.stage1Complete);

  return (
    <ScreenFrame eyebrow="Stage 1 prototype" title="Tasmania Martial Arts Championship" showSettings={false}>
      <div className="title-screen">
        <div className="title-screen__inner animate-rise">
          <span className="title-screen__mark">Sport karate · Stage 1 prototype</span>
          <h2 className="title-screen__title">Six clubs. One island. One championship.</h2>
          <p className="title-screen__subtitle">
            Choose a Tasmanian club, pick your fighter, and complete your first training session under
            the coach at the Hobart dojo.
          </p>

          <div className="title-screen__actions">
            <Button variant="primary" size="large" onClick={startNewGame} data-testid="start-game">
              Start new game
            </Button>
            {canContinue ? (
              <Button size="large" onClick={continueGame} data-testid="continue-game">
                Continue
              </Button>
            ) : null}
            <Button variant="ghost" size="large" onClick={openSettings} data-testid="open-settings">
              Settings
            </Button>
          </div>

          {canContinue ? (
            <p className="subtle" data-testid="progress-summary">
              {stage1Complete
                ? 'Stage 1 complete — the first tournament match is unlocked.'
                : `Training progress: ${Math.round(completion * 100)}% of the dojo session complete.`}
            </p>
          ) : null}

          <div className="title-screen__meta">
            <span>{CONTROL_GUIDE.length} keyboard controls</span>
            <span aria-hidden="true">·</span>
            <span>Keyboard and mouse, desktop</span>
            <span aria-hidden="true">·</span>
            <span>Family-friendly sport combat</span>
          </div>

          <p className="subtle" style={{ maxWidth: '40rem' }}>
            All characters and clubs in this game are fictionalised. They do not represent the real
            appearance, ability, history or personal circumstances of any real person.
          </p>
        </div>
      </div>
    </ScreenFrame>
  );
}
