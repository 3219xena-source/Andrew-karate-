/**
 * Fight screen — one bout, played live.
 *
 * Owns the frame loop and wires the systems together:
 *
 *   FightInputManager ─┐
 *                      ├─▶ MatchEngine ─┬─▶ arenaRenderer (canvas)
 *   OpponentAI ────────┘                ├─▶ AudioManager (event sounds)
 *                                       └─▶ HUD (React, ~12 fps)
 *
 * React re-renders only the HUD. The simulation and the canvas run at the
 * display's refresh rate inside the loop, so combat never waits on a render.
 *
 * Every value shown in the HUD comes from live engine state — nothing is
 * mocked, and no number is displayed that the simulation does not own.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { renderArena, type ImpactEffect } from '../components/fight/arenaRenderer.ts';
import { Button } from '../components/ui/Button.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { ScreenFrame } from '../components/ui/ScreenFrame.tsx';
import { getTeam } from '../data/teams.ts';
import { getVenue } from '../data/venues.ts';
import { audioManager } from '../systems/audio/audioManager.ts';
import { OpponentAI, difficultyForClub } from '../systems/ai/opponentAI.ts';
import { MatchEngine } from '../systems/match/matchEngine.ts';
import { ROUNDS_TO_WIN_BOUT } from '../systems/match/constants.ts';
import type { MatchEvent } from '../systems/match/types.ts';
import { FIGHT_CONTROL_GUIDE, FightInputManager } from '../systems/input/fightInput.ts';
import {
  selectActiveEvent,
  selectVenueForEvent,
  useGameStore,
  getEventController,
} from '../state/gameStore.ts';
import type { BoutResult } from '../types/season.ts';

/** Milliseconds between HUD re-renders. */
const HUD_INTERVAL_MS = 80;
/** Seconds an impact effect stays on screen. */
const EFFECT_LIFE = 0.28;
/** Seconds the "Ready" announcement holds before the round starts. */
const READY_SECONDS = 1.6;

function soundForEvent(event: MatchEvent): Parameters<typeof audioManager.play>[0] | null {
  switch (event.type) {
    case 'hit':
      return event.attack === 'powerAttack'
        ? 'power-move'
        : event.attack === 'strongPunch' || event.attack === 'strongKick'
          ? 'strong-impact'
          : 'light-impact';
    case 'blocked':
      return 'block';
    case 'dodged':
      return 'dodge';
    case 'jump':
      return 'footstep';
    case 'power-ready':
      return 'power-charge';
    case 'exhausted':
      return 'exhausted';
    case 'knockout':
      return 'knockout';
    case 'round-start':
      return 'round-start';
    case 'time-warning':
      return 'timer-warning';
    default:
      return null;
  }
}

export function FightScreen() {
  const activeBout = useGameStore((state) => state.activeBout);
  const difficulty = useGameStore((state) => state.difficulty);
  const accessibility = useGameStore((state) => state.accessibility);
  const recordBoutResult = useGameStore((state) => state.recordBoutResult);
  const goToScreen = useGameStore((state) => state.goToScreen);
  const event = useGameStore(selectActiveEvent);
  const venue = selectVenueForEvent(event) ?? getVenue('hobart-arena');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<MatchEngine | null>(null);
  const aiRef = useRef<OpponentAI | null>(null);
  const inputRef = useRef<FightInputManager | null>(null);
  const effectsRef = useRef<ImpactEffect[]>([]);

  const [paused, setPaused] = useState(false);
  const [announcement, setAnnouncement] = useState('Ready');
  const [, forceHud] = useReducer((tick: number) => tick + 1, 0);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const accessibilityRef = useRef(accessibility);
  accessibilityRef.current = accessibility;
  const recordRef = useRef(recordBoutResult);
  recordRef.current = recordBoutResult;

  const playerFighter = activeBout?.playerFighter;
  const opponentFighter = activeBout?.opponentFighter;
  const opponentTeam = getTeam(opponentFighter?.teamId);
  const playerTeam = getTeam(playerFighter?.teamId);

  // ── Engine lifecycle ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!playerFighter || !opponentFighter || !venue) return undefined;

    // The player is always in the red corner; the AI is always blue.
    const engine = new MatchEngine(playerFighter, opponentFighter, { humanCorner: 'red' });
    const aiDifficulty = difficultyForClub(
      getTeam(opponentFighter.teamId)?.difficulty ?? 'competitive',
      difficulty,
    );
    const ai = new OpponentAI({
      difficulty: aiDifficulty,
      profile: opponentFighter.aiProfile,
      corner: 'blue',
      // Seeding from the fighter ids keeps a given bout reproducible.
      seed: hashString(`${playerFighter.id}:${opponentFighter.id}`),
    });
    const input = new FightInputManager();
    input.onPause = () => setPaused((current) => !current);
    input.attach(window);

    engineRef.current = engine;
    aiRef.current = ai;
    inputRef.current = input;
    effectsRef.current = [];

    audioManager.setMusicRequested(false);

    let frame = 0;
    let last = performance.now();
    let hudAccumulator = 0;
    let elapsed = 0;
    let readyTimer = READY_SECONDS;
    let shake = 0;
    let submitted = false;

    const loop = (now: number) => {
      frame = window.requestAnimationFrame(loop);
      const deltaMs = now - last;
      last = now;
      const dt = Math.min(deltaMs / 1000, 0.05);

      if (!pausedRef.current) {
        elapsed += dt;
        const state = engine.getState();

        // Pre-round announcement, then the round begins.
        if (state.phase === 'ready') {
          readyTimer -= dt;
          if (readyTimer <= 0) {
            engine.beginFighting();
            setAnnouncement('Fight');
            window.setTimeout(() => setAnnouncement(''), 900);
          }
        } else if (state.phase === 'fighting') {
          const playerInput = input.snapshot();
          const aiInput = ai.update(state, dt);
          engine.advance(dt, playerInput, aiInput);
        }

        for (const matchEvent of engine.drainEvents()) {
          const sound = soundForEvent(matchEvent);
          if (sound) audioManager.play(sound);
          pushEffect(effectsRef.current, matchEvent, playerFighter.animation.accentColour);

          if (matchEvent.type === 'hit') {
            shake = Math.min(1, shake + (matchEvent.attack === 'powerAttack' ? 0.9 : 0.32));
          }
          if (matchEvent.type === 'round-end') {
            const winnerLabel =
              engine.getState().roundWinner === 'red'
                ? `${playerFighter.name} takes the round`
                : engine.getState().roundWinner === 'blue'
                  ? `${opponentFighter.name} takes the round`
                  : 'Round drawn';
            setAnnouncement(winnerLabel);
          }
        }

        // Advance effects and the shake decay.
        effectsRef.current = effectsRef.current.filter((effect) => {
          effect.life -= dt;
          return effect.life > 0;
        });
        shake = Math.max(0, shake - dt * 2.4);

        const current = engine.getState();

        // Between rounds: hold the result briefly, then reset for the next one.
        if (current.phase === 'round-over') {
          readyTimer -= dt;
          if (readyTimer <= -1.8) {
            engine.startNextRound();
            readyTimer = READY_SECONDS;
            setAnnouncement('Ready');
            audioManager.play('round-start');
          }
        }

        if (current.phase === 'bout-over' && !submitted) {
          submitted = true;
          audioManager.play(current.boutWinner === 'red' ? 'bout-win' : 'bout-loss');
          window.cancelAnimationFrame(frame);
          recordRef.current(buildBoutResult(engine, activeBout?.index ?? 0, activeBout?.isTieBreaker ?? false));
          return;
        }
      }

      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (canvas && context) {
        resizeCanvas(canvas);
        renderArena(context, engine.getState(), {
          venue,
          redFighter: playerFighter,
          blueFighter: opponentFighter,
          redLabel: getTeam(playerFighter.teamId)?.shortName ?? '',
          blueLabel: getTeam(opponentFighter.teamId)?.shortName ?? '',
          effects: effectsRef.current,
          elapsed,
          reducedMotion: accessibilityRef.current.reducedMotion,
          shake: accessibilityRef.current.screenShake ? shake : 0,
          paused: pausedRef.current,
        });
      }

      hudAccumulator += deltaMs;
      if (hudAccumulator >= HUD_INTERVAL_MS) {
        hudAccumulator = 0;
        forceHud();
      }
    };

    frame = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(frame);
      input.detach();
      engineRef.current = null;
      aiRef.current = null;
      inputRef.current = null;
    };
    // The engine is rebuilt only when the bout changes; difficulty and
    // accessibility are read through refs so a settings change mid-bout does
    // not restart the fight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerFighter, opponentFighter, venue]);

  useEffect(() => {
    if (paused) inputRef.current?.clear();
  }, [paused]);

  const forfeit = useCallback(() => {
    setPaused(false);
    goToScreen('season');
  }, [goToScreen]);

  if (!activeBout || !playerFighter || !opponentFighter || !venue) {
    return (
      <ScreenFrame eyebrow="Competition" title="Bout">
        <div className="state-block" role="alert">
          <h2 className="state-block__title">No bout is in progress</h2>
          <p className="state-block__body">
            There is no scheduled bout to fight. Return to the season and open the next event.
          </p>
          <Button variant="primary" onClick={() => goToScreen('season')}>
            Back to the season
          </Button>
        </div>
      </ScreenFrame>
    );
  }

  const state = engineRef.current?.getState();
  const red = state?.red;
  const blue = state?.blue;
  const controller = getEventController();
  const clubScore = controller
    ? `${controller.getPlayerScore()} — ${controller.getOpponentScore()}`
    : '0 — 0';

  return (
    <ScreenFrame
      eyebrow={`${event?.name ?? 'Exhibition'} · ${venue.name}`}
      title={`${playerFighter.name} vs ${opponentFighter.name}`}
      wide
      actions={
        <Button variant="ghost" onClick={() => setPaused(true)} data-testid="pause-fight">
          Pause
        </Button>
      }
    >
      <div className="fight-layout">
        {/* ── HUD: every value is read from live engine state ─────────────── */}
        <div className="fight-hud" data-testid="fight-hud">
          <FighterHud
            side="left"
            name={playerFighter.name}
            club={playerTeam?.shortName ?? ''}
            colour={playerTeam?.colours.primary ?? '#4d86e8'}
            health={red?.health ?? 0}
            maxHealth={red?.maxHealth ?? 1}
            stamina={red?.stamina ?? 0}
            maxStamina={red?.maxStamina ?? 1}
            power={red?.power ?? 0}
            roundWins={red?.roundWins ?? 0}
            testId="hud-player"
          />

          <div className="fight-hud__centre">
            <p className="fight-hud__division">
              {playerFighter.ageClassification === 'junior' ? 'Junior division' : 'Open division'}
            </p>
            <p className="fight-hud__timer" data-testid="round-timer">
              {Math.ceil(state?.timeRemaining ?? 0)}
            </p>
            <p className="fight-hud__round" data-testid="round-indicator">
              Round {state?.round ?? 1}
              {state?.suddenDeath ? ' · Sudden death' : ''}
            </p>
            <p className="fight-hud__score" data-testid="club-score">
              Club score {clubScore}
            </p>
            <p className="fight-hud__bout">
              {activeBout.isTieBreaker ? 'Deciding bout' : `Bout ${activeBout.index + 1} of 6`}
            </p>
          </div>

          <FighterHud
            side="right"
            name={opponentFighter.name}
            club={opponentTeam?.shortName ?? ''}
            colour={opponentTeam?.colours.primary ?? '#c05a54'}
            health={blue?.health ?? 0}
            maxHealth={blue?.maxHealth ?? 1}
            stamina={blue?.stamina ?? 0}
            maxStamina={blue?.maxStamina ?? 1}
            power={blue?.power ?? 0}
            roundWins={blue?.roundWins ?? 0}
            testId="hud-opponent"
          />
        </div>

        <div className="fight-stage">
          <canvas
            ref={canvasRef}
            className="fight-canvas"
            tabIndex={0}
            role="application"
            aria-label={`Competition arena at ${venue.name}. ${playerFighter.name} versus ${opponentFighter.name}. Use the listed controls to fight.`}
          />
          {announcement ? (
            <p
              className="fight-announcement"
              role="status"
              aria-live="assertive"
              data-testid="announcement"
            >
              {announcement}
            </p>
          ) : null}
        </div>

        <details className="fight-controls">
          <summary>Controls</summary>
          <table className="control-table">
            <thead>
              <tr>
                <th scope="col">Key</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {FIGHT_CONTROL_GUIDE.map((entry) => (
                <tr key={entry.keys}>
                  <td>{entry.keys}</td>
                  <td>{entry.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>

      <Modal open={paused} title="Bout paused" onClose={() => setPaused(false)}>
        <p className="muted">
          The round clock, both fighters and the opponent AI are all stopped. Bouts you have already
          won in this event are saved; this bout restarts from round one if you leave.
        </p>
        <div className="modal__actions">
          <Button variant="primary" onClick={() => setPaused(false)} data-testid="resume-fight">
            Resume
          </Button>
          <Button variant="ghost" sound="menu-back" onClick={forfeit} data-testid="leave-fight">
            Leave bout
          </Button>
        </div>
      </Modal>
    </ScreenFrame>
  );
}

interface FighterHudProps {
  readonly side: 'left' | 'right';
  readonly name: string;
  readonly club: string;
  readonly colour: string;
  readonly health: number;
  readonly maxHealth: number;
  readonly stamina: number;
  readonly maxStamina: number;
  readonly power: number;
  readonly roundWins: number;
  readonly testId: string;
}

function FighterHud(props: FighterHudProps) {
  const healthPercent = Math.max(0, Math.round((props.health / props.maxHealth) * 100));
  const staminaPercent = Math.max(0, Math.round((props.stamina / props.maxStamina) * 100));
  const powerPercent = Math.max(0, Math.min(100, Math.round(props.power)));
  // Health status is given as a word as well as a bar, so condition is never
  // communicated by colour or length alone.
  const condition =
    healthPercent > 66 ? 'Strong' : healthPercent > 33 ? 'Tiring' : healthPercent > 0 ? 'Critical' : 'Out';

  return (
    <div className={`fighter-hud fighter-hud--${props.side}`} data-testid={props.testId}>
      <div className="fighter-hud__head">
        <span className="fighter-hud__club" style={{ background: props.colour }}>
          {props.club}
        </span>
        <span className="fighter-hud__name">{props.name}</span>
      </div>

      <div
        className="fighter-hud__bar fighter-hud__bar--health"
        role="meter"
        aria-label={`${props.name} health`}
        aria-valuenow={healthPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${healthPercent} per cent, ${condition}`}
        data-testid={`${props.testId}-health`}
        data-health={healthPercent}
      >
        <span className="fighter-hud__fill" style={{ width: `${healthPercent}%` }} />
      </div>

      <div className="fighter-hud__meters">
        <div
          className="fighter-hud__bar fighter-hud__bar--stamina"
          role="meter"
          aria-label={`${props.name} stamina`}
          aria-valuenow={staminaPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          data-testid={`${props.testId}-stamina`}
        >
          <span className="fighter-hud__fill" style={{ width: `${staminaPercent}%` }} />
        </div>
        <div
          className={`fighter-hud__bar fighter-hud__bar--power${powerPercent >= 100 ? ' is-ready' : ''}`}
          role="meter"
          aria-label={`${props.name} power`}
          aria-valuenow={powerPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={powerPercent >= 100 ? 'Power ready' : `${powerPercent} per cent`}
          data-testid={`${props.testId}-power`}
        >
          <span className="fighter-hud__fill" style={{ width: `${powerPercent}%` }} />
        </div>
      </div>

      <div className="fighter-hud__foot">
        <span className="fighter-hud__condition">{condition}</span>
        <span className="fighter-hud__rounds" data-testid={`${props.testId}-rounds`}>
          {Array.from({ length: ROUNDS_TO_WIN_BOUT }, (_, index) => (
            <span
              key={index}
              className={`round-pip${index < props.roundWins ? ' round-pip--won' : ''}`}
              aria-hidden="true"
            />
          ))}
          <span className="visually-hidden">{props.roundWins} rounds won</span>
        </span>
      </div>
    </div>
  );
}

/** Converts the engine's final state into a saved bout result. */
function buildBoutResult(engine: MatchEngine, index: number, isTieBreaker: boolean): BoutResult {
  const state = engine.getState();
  const red = state.red;
  const blue = state.blue;
  return {
    index,
    playerFighterId: red.id,
    opponentFighterId: blue.id,
    winner: state.boutWinner === 'red' ? 'player' : 'opponent',
    playerRounds: red.roundWins,
    opponentRounds: blue.roundWins,
    endReason: state.roundEndReason ?? 'timeout',
    stats: {
      damageDealt: Math.round(red.stats.damageDealt),
      damageTaken: Math.round(red.stats.damageTaken),
      punchesLanded: red.stats.punchesLanded,
      kicksLanded: red.stats.kicksLanded,
      strongAttacksLanded: red.stats.strongAttacksLanded,
      attacksBlocked: red.stats.attacksBlocked,
      dodgesSucceeded: red.stats.dodgesSucceeded,
      powerMovesUsed: red.stats.powerMovesUsed,
      knockouts: red.stats.knockouts,
    },
    isTieBreaker,
  };
}

function pushEffect(effects: ImpactEffect[], event: MatchEvent, playerColour: string): void {
  if (event.x === undefined || event.y === undefined) return;
  const kind: ImpactEffect['kind'] =
    event.type === 'hit'
      ? event.attack === 'powerAttack'
        ? 'power'
        : 'hit'
      : event.type === 'blocked'
        ? 'blocked'
        : event.type === 'dodged'
          ? 'dodged'
          : 'hit';
  if (event.type !== 'hit' && event.type !== 'blocked' && event.type !== 'dodged') return;

  effects.push({
    x: event.x,
    y: event.y,
    life: EFFECT_LIFE,
    maxLife: EFFECT_LIFE,
    kind,
    colour: kind === 'blocked' ? '#8fe0bb' : kind === 'dodged' ? '#ffffff' : playerColour,
  });
  // Cap the effect list so a long exchange cannot grow it without bound.
  if (effects.length > 24) effects.splice(0, effects.length - 24);
}

function resizeCanvas(canvas: HTMLCanvasElement): void {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(canvas.clientWidth * ratio);
  const height = Math.round(canvas.clientHeight * ratio);
  if (width > 0 && height > 0 && (canvas.width !== width || canvas.height !== height)) {
    canvas.width = width;
    canvas.height = height;
  }
}

function hashString(input: string): number {
  let value = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value);
}
