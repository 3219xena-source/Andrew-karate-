/**
 * Training dojo.
 *
 * Owns the frame loop and wires the four systems together:
 *
 *   InputManager → CombatEngine → TutorialEngine → game store (persistence)
 *                       ↓
 *                    renderer (canvas)  +  AudioManager (event sounds)
 *
 * React re-renders only the HUD, and only about twelve times a second. The
 * simulation and the canvas run at the display's refresh rate inside the loop,
 * so combat never waits on a React render.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { renderDojo } from '../components/dojo/renderer.ts';
import { Button } from '../components/ui/Button.tsx';
import { Meter } from '../components/ui/Meter.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { Portrait } from '../components/ui/Portrait.tsx';
import { ScreenFrame } from '../components/ui/ScreenFrame.tsx';
import { getFighter } from '../data/fighters.ts';
import { TUTORIAL_OBJECTIVES } from '../data/tutorial.ts';
import { audioManager } from '../systems/audio/audioManager.ts';
import { CombatEngine } from '../systems/combat/combatEngine.ts';
import type { CombatEvent } from '../systems/combat/types.ts';
import { CONTROL_GUIDE, InputManager } from '../systems/input/inputManager.ts';
import { TutorialEngine } from '../systems/tutorial/tutorialEngine.ts';
import { selectSelectedFighter, useGameStore } from '../state/gameStore.ts';

/** Milliseconds between HUD re-renders. */
const HUD_INTERVAL_MS = 80;
/** Seconds between footstep sounds while walking. */
const FOOTSTEP_INTERVAL = 0.32;

/** The coach character. Falls back gracefully if the record is ever removed. */
const COACH_ID = 'mr-graham';

function soundForEvent(event: CombatEvent): Parameters<typeof audioManager.play>[0] | null {
  switch (event.type) {
    case 'hit':
      return event.power === 'strong' ? 'strong-impact' : 'light-impact';
    case 'block':
      return 'block';
    case 'dodge':
    case 'evade':
      return 'dodge';
    case 'strike-telegraph':
      return 'telegraph';
    case 'strike-contact':
      return 'block';
    case 'exhausted':
      return 'exhausted';
    case 'bow':
      return 'training-success';
    case 'combo':
      return 'training-success';
    default:
      return null;
  }
}

export function DojoScreen() {
  const fighter = useGameStore(selectSelectedFighter);
  const reducedMotion = useGameStore((state) => state.accessibility.reducedMotion);
  const completedObjectiveIds = useGameStore((state) => state.progress.completedObjectiveIds);
  const completeObjective = useGameStore((state) => state.completeObjective);
  const completeTutorial = useGameStore((state) => state.completeTutorial);
  const goToScreen = useGameStore((state) => state.goToScreen);
  const restartTutorial = useGameStore((state) => state.restartTutorial);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CombatEngine | null>(null);
  const tutorialRef = useRef<TutorialEngine | null>(null);
  const inputRef = useRef<InputManager | null>(null);

  const [paused, setPaused] = useState(false);
  const [coachLine, setCoachLine] = useState<string>('');
  const [, forceHudUpdate] = useReducer((tick: number) => tick + 1, 0);

  // Mirror the paused flag into a ref: the loop is created once and must see
  // the current value without being torn down and rebuilt on every toggle.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Objective completions are handled inside the loop, which cannot depend on
  // changing props. Latest-value refs keep those callbacks current.
  const completeObjectiveRef = useRef(completeObjective);
  completeObjectiveRef.current = completeObjective;
  const completeTutorialRef = useRef(completeTutorial);
  completeTutorialRef.current = completeTutorial;
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  const fighterRef = useRef(fighter);
  fighterRef.current = fighter;

  // ── Engine lifecycle ──────────────────────────────────────────────────────
  //
  // Built once per fighter. `completedObjectiveIds` is read at construction so
  // a returning player resumes at the right objective, but it is deliberately
  // NOT a dependency: it changes as objectives complete, and rebuilding the
  // engine mid-session would reset the fighter's position.
  useEffect(() => {
    if (!fighter) return undefined;

    const engine = new CombatEngine(fighter);
    const tutorial = new TutorialEngine(
      engine,
      TUTORIAL_OBJECTIVES,
      useGameStore.getState().progress.completedObjectiveIds,
    );
    tutorial.applyPadPolicy();

    const input = new InputManager();
    input.onPause = () => setPaused((current) => !current);
    input.onReset = () => engine.resetPosition();
    input.attach(window);

    engineRef.current = engine;
    tutorialRef.current = tutorial;
    inputRef.current = input;

    setCoachLine(tutorial.getActiveObjective()?.coachLine ?? '');
    audioManager.setMusicRequested(true);

    let frame = 0;
    let lastTime = performance.now();
    let hudAccumulator = 0;
    let footstepTimer = 0;
    let elapsed = 0;

    const loop = (now: number) => {
      frame = window.requestAnimationFrame(loop);

      const deltaMs = now - lastTime;
      lastTime = now;
      const dt = Math.min(deltaMs / 1000, 0.05);

      if (!pausedRef.current) {
        elapsed += dt;
        engine.advance(dt, input.snapshot());

        const events = engine.drainEvents();
        for (const event of events) {
          const sound = soundForEvent(event);
          if (sound) audioManager.play(sound);
        }

        // Footsteps are cosmetic and frequent, so they are driven here rather
        // than added to the engine's event stream.
        const fighterState = engine.getState().fighter;
        if (fighterState.moving && fighterState.grounded) {
          footstepTimer += dt;
          if (footstepTimer >= FOOTSTEP_INTERVAL) {
            footstepTimer = 0;
            audioManager.play('footstep');
          }
        } else {
          footstepTimer = FOOTSTEP_INTERVAL;
        }

        const update = tutorial.update(events);
        for (const objective of update.completed) {
          completeObjectiveRef.current(objective.id);
          setCoachLine(objective.successLine);
          audioManager.play('training-success');
        }

        if (update.completed.length > 0 && !update.finished) {
          // Show the success line briefly, then the next instruction.
          const next = tutorial.getActiveObjective();
          if (next) {
            window.setTimeout(() => setCoachLine(next.coachLine), 1600);
          }
        }

        if (update.finished) {
          audioManager.play('tutorial-complete');
          audioManager.play('applause');
          window.cancelAnimationFrame(frame);
          completeTutorialRef.current();
          return;
        }
      }

      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (canvas && context) {
        resizeCanvas(canvas);
        renderDojo(context, engine.getState(), {
          fighter: fighterRef.current ?? null,
          reducedMotion: reducedMotionRef.current,
          elapsed,
          paused: pausedRef.current,
        });
      }

      hudAccumulator += deltaMs;
      if (hudAccumulator >= HUD_INTERVAL_MS) {
        hudAccumulator = 0;
        forceHudUpdate();
      }
    };

    frame = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(frame);
      input.detach();
      audioManager.setMusicRequested(false);
      engineRef.current = null;
      tutorialRef.current = null;
      inputRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
  }, [fighter]);

  // Releasing every held key on pause prevents a key held through the pause
  // from still being "down" when play resumes.
  useEffect(() => {
    if (paused) inputRef.current?.clear();
  }, [paused]);

  const handleRestart = useCallback(() => {
    tutorialRef.current?.reset();
    engineRef.current?.resetPosition();
    setPaused(false);
    restartTutorial();
    setCoachLine(TUTORIAL_OBJECTIVES[0]?.coachLine ?? '');
  }, [restartTutorial]);

  if (!fighter) {
    return (
      <ScreenFrame eyebrow="Training" title="Dojo">
        <div className="state-block" role="alert">
          <h2 className="state-block__title">No fighter is selected</h2>
          <p className="state-block__body">
            The dojo needs a selected fighter before a session can begin. Choose a club and a fighter,
            then return here.
          </p>
          <Button variant="primary" onClick={() => goToScreen('map')}>
            Back to the map
          </Button>
        </div>
      </ScreenFrame>
    );
  }

  const engine = engineRef.current;
  const tutorial = tutorialRef.current;
  const progress = tutorial?.getProgress() ?? [];
  const activeObjective = tutorial?.getActiveObjective() ?? null;
  const stamina = engine?.getState().fighter.stamina ?? 0;
  const staminaMax = engine?.getState().fighter.staminaMax ?? 1;
  const coach = getFighter(COACH_ID);
  const done = completedObjectiveIds.length;

  return (
    <ScreenFrame
      eyebrow={`Training · ${fighter.name}`}
      title="Hobart dojo"
      wide
      actions={
        <Button variant="ghost" onClick={() => setPaused(true)} data-testid="pause">
          Pause
        </Button>
      }
      footer={
        <>
          <Button
            variant="ghost"
            sound="menu-back"
            onClick={() => goToScreen('fighter-select')}
            data-testid="dojo-back"
          >
            Change fighter
          </Button>
          <span className="subtle">
            Objective {Math.min(done + 1, TUTORIAL_OBJECTIVES.length)} of {TUTORIAL_OBJECTIVES.length}
          </span>
        </>
      }
    >
      <div className="dojo-layout">
        <div className="dojo-stage">
          <div className="dojo-canvas-wrap">
            <canvas
              ref={canvasRef}
              className="dojo-canvas"
              tabIndex={0}
              role="application"
              aria-label={`Training dojo. ${activeObjective?.instruction ?? 'Session complete.'}`}
            />
          </div>

          <div className="dojo-hud">
            <Meter
              label="Stamina"
              value={stamina}
              max={staminaMax}
              readout={`${Math.round(stamina)} / ${Math.round(staminaMax)}`}
            />
            <Meter
              label="Session progress"
              value={done}
              max={TUTORIAL_OBJECTIVES.length}
              lowThreshold={0}
              readout={`${done} of ${TUTORIAL_OBJECTIVES.length} objectives`}
            />
          </div>
        </div>

        <div className="stack">
          <section className="coach" aria-live="polite" data-testid="coach-panel">
            {coach ? (
              <div className="coach__portrait">
                <Portrait fighter={coach} compact />
              </div>
            ) : null}
            <div>
              <p className="coach__name">{coach?.name ?? 'Coach'} · Coach</p>
              <p className="coach__line">{coachLine}</p>
            </div>
          </section>

          <section className="panel" aria-labelledby="objectives-heading">
            <h2 className="panel__title" id="objectives-heading">
              Session objectives
            </h2>
            <p className="subtle" data-testid="active-instruction" style={{ marginBottom: 'var(--space-3)' }}>
              {activeObjective?.instruction ?? 'All objectives complete.'}
            </p>
            <ol className="objectives" data-testid="objective-list">
              {TUTORIAL_OBJECTIVES.map((objective, index) => {
                const entry = progress[index];
                const complete = entry?.complete ?? completedObjectiveIds.includes(objective.id);
                const active = activeObjective?.id === objective.id;
                return (
                  <li
                    key={objective.id}
                    data-testid={`objective-${objective.id}`}
                    data-complete={complete ? 'true' : 'false'}
                    className={[
                      'objective',
                      active ? 'objective--active' : '',
                      complete ? 'objective--complete' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span className="objective__marker" aria-hidden="true">
                      {complete ? '✓' : index + 1}
                    </span>
                    <span>
                      {objective.title}
                      <span className="visually-hidden">
                        {complete ? ' — complete' : active ? ' — in progress' : ' — not started'}
                      </span>
                    </span>
                    <span className="objective__progress">
                      {entry && entry.target > 1 ? `${entry.current}/${entry.target}` : ''}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="panel" aria-labelledby="dojo-controls">
            <h2 className="panel__title" id="dojo-controls">
              Controls
            </h2>
            <table className="control-table">
              <thead>
                <tr>
                  <th scope="col">Key</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {CONTROL_GUIDE.map((entry) => (
                  <tr key={entry.keys}>
                    <td>{entry.keys}</td>
                    <td>{entry.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>

      <Modal open={paused} title="Session paused" onClose={() => setPaused(false)}>
        <p className="muted">
          Training is paused. Nothing is lost — every completed objective has already been saved.
        </p>
        <div className="modal__actions">
          <Button variant="primary" onClick={() => setPaused(false)} data-testid="resume">
            Resume
          </Button>
          <Button onClick={handleRestart} data-testid="restart-session">
            Restart session
          </Button>
          <Button
            variant="ghost"
            sound="menu-back"
            onClick={() => {
              setPaused(false);
              goToScreen('fighter-select');
            }}
          >
            Change fighter
          </Button>
        </div>
      </Modal>
    </ScreenFrame>
  );
}

/**
 * Matches the drawing buffer to the element's on-screen size and the display's
 * pixel density, so the dojo is crisp on high-DPI screens and after a resize.
 */
function resizeCanvas(canvas: HTMLCanvasElement): void {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(canvas.clientWidth * ratio);
  const height = Math.round(canvas.clientHeight * ratio);
  if (width > 0 && height > 0 && (canvas.width !== width || canvas.height !== height)) {
    canvas.width = width;
    canvas.height = height;
  }
}
