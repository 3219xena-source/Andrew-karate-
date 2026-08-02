/**
 * Training-dojo renderer.
 *
 * A pure drawing function: given a 2D context and a combat state, it paints one
 * frame. It holds no state of its own, so the dojo screen can re-render at any
 * time and the simulation stays the single source of truth.
 *
 * The fighter is drawn procedurally from the fighter's configured gi, belt and
 * accent colours — the Stage 1 stand-in for a character model. Presentation is
 * sport karate: controlled techniques against a padded target, no impact
 * effects that suggest injury.
 */

import type { Fighter } from '../../types/fighter.ts';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  FIGHTER_HEIGHT,
  MARK_RADIUS,
  MARK_X,
  PAD_HALF_WIDTH,
  PAD_HEIGHT,
} from '../../systems/combat/constants.ts';
import type { CombatState } from '../../systems/combat/types.ts';

/** Y coordinate of the floor line in arena space. */
const FLOOR_Y = 430;

export interface RenderOptions {
  readonly fighter: Fighter | null;
  /** Suppresses the ambient background animation. */
  readonly reducedMotion: boolean;
  /** Seconds since the dojo opened, used for ambient motion only. */
  readonly elapsed: number;
  /** Drawn across the scene when the session is paused. */
  readonly paused: boolean;
}

export function renderDojo(
  context: CanvasRenderingContext2D,
  state: CombatState,
  options: RenderOptions,
): void {
  const { width, height } = context.canvas;
  const scale = Math.min(width / ARENA_WIDTH, height / ARENA_HEIGHT);

  context.save();
  context.clearRect(0, 0, width, height);
  context.setTransform(scale, 0, 0, scale, (width - ARENA_WIDTH * scale) / 2, (height - ARENA_HEIGHT * scale) / 2);

  drawBackground(context, options);
  drawFloor(context);
  drawMark(context, state);
  drawPad(context, state);
  drawFighter(context, state, options);

  if (options.paused) drawPausedVeil(context);

  context.restore();
}

function drawBackground(context: CanvasRenderingContext2D, options: RenderOptions): void {
  const wall = context.createLinearGradient(0, 0, 0, FLOOR_Y);
  wall.addColorStop(0, '#131c28');
  wall.addColorStop(1, '#1b2634');
  context.fillStyle = wall;
  context.fillRect(0, 0, ARENA_WIDTH, FLOOR_Y);

  // Timber wall panelling.
  context.strokeStyle = 'rgba(107, 74, 47, 0.35)';
  context.lineWidth = 2;
  for (let x = 0; x <= ARENA_WIDTH; x += 100) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, FLOOR_Y);
    context.stroke();
  }

  // Club banner. A gentle sway unless reduced motion is requested.
  const sway = options.reducedMotion ? 0 : Math.sin(options.elapsed * 0.9) * 3;
  context.save();
  context.translate(120, 60 + sway);
  context.fillStyle = '#1d3358';
  context.fillRect(-38, -40, 76, 150);
  context.strokeStyle = '#d8a83c';
  context.lineWidth = 3;
  context.strokeRect(-38, -40, 76, 150);
  context.fillStyle = '#d8a83c';
  context.font = '600 26px system-ui, sans-serif';
  context.textAlign = 'center';
  context.fillText('道', 0, 40);
  context.restore();

  // Window onto a cold southern sky.
  context.fillStyle = 'rgba(120, 170, 220, 0.10)';
  context.fillRect(700, 50, 220, 130);
  context.strokeStyle = 'rgba(238, 242, 248, 0.18)';
  context.lineWidth = 3;
  context.strokeRect(700, 50, 220, 130);
  context.beginPath();
  context.moveTo(810, 50);
  context.lineTo(810, 180);
  context.moveTo(700, 115);
  context.lineTo(920, 115);
  context.stroke();
}

function drawFloor(context: CanvasRenderingContext2D): void {
  const floor = context.createLinearGradient(0, FLOOR_Y, 0, ARENA_HEIGHT);
  floor.addColorStop(0, '#2c4a6b');
  floor.addColorStop(1, '#1a2c40');
  context.fillStyle = floor;
  context.fillRect(0, FLOOR_Y, ARENA_WIDTH, ARENA_HEIGHT - FLOOR_Y);

  // Mat seams give the floor a sense of depth and scale.
  context.strokeStyle = 'rgba(8, 11, 17, 0.35)';
  context.lineWidth = 2;
  for (let x = 0; x <= ARENA_WIDTH; x += 125) {
    context.beginPath();
    context.moveTo(x, FLOOR_Y);
    context.lineTo(x + 30, ARENA_HEIGHT);
    context.stroke();
  }

  context.strokeStyle = 'rgba(238, 242, 248, 0.25)';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(0, FLOOR_Y);
  context.lineTo(ARENA_WIDTH, FLOOR_Y);
  context.stroke();
}

/** The tutorial's marked starting area. */
function drawMark(context: CanvasRenderingContext2D, state: CombatState): void {
  const onMark = Math.abs(state.fighter.x - MARK_X) <= MARK_RADIUS;
  context.save();
  context.strokeStyle = onMark ? '#4bbd8b' : 'rgba(216, 168, 60, 0.75)';
  context.lineWidth = 3;
  context.beginPath();
  context.ellipse(MARK_X, FLOOR_Y + 26, MARK_RADIUS, 12, 0, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

/** The padded practice target and its telegraph. */
function drawPad(context: CanvasRenderingContext2D, state: CombatState): void {
  const { pad } = state;
  const baseY = FLOOR_Y + 20;
  const recoilOffset = pad.recoil * 10;

  context.save();
  context.translate(pad.x + recoilOffset, baseY);

  // Post and base.
  context.fillStyle = '#3d4d66';
  context.fillRect(-8, -PAD_HEIGHT, 16, PAD_HEIGHT);
  context.fillStyle = '#2a3648';
  context.beginPath();
  context.ellipse(0, 0, 42, 12, 0, 0, Math.PI * 2);
  context.fill();

  // Padded body.
  const padGradient = context.createLinearGradient(-PAD_HALF_WIDTH, 0, PAD_HALF_WIDTH, 0);
  padGradient.addColorStop(0, '#8a4b3f');
  padGradient.addColorStop(1, '#c0685c');
  context.fillStyle = padGradient;
  roundedRect(context, -PAD_HALF_WIDTH, -PAD_HEIGHT - 10, PAD_HALF_WIDTH * 2, 96, 14);
  context.fill();
  context.strokeStyle = 'rgba(8, 11, 17, 0.5)';
  context.lineWidth = 2;
  context.stroke();

  // Coach's practice arm, extended during the active window.
  if (pad.striking && pad.phase !== 'idle') {
    const extend = pad.phase === 'active' ? 1 : pad.phase === 'telegraph' ? -0.3 : 0.4;
    context.strokeStyle = pad.phase === 'active' ? '#e0a13a' : 'rgba(224, 161, 58, 0.55)';
    context.lineWidth = 12;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(-10, -PAD_HEIGHT + 30);
    context.lineTo(-10 - 70 * extend, -PAD_HEIGHT + 44);
    context.stroke();
  }

  context.restore();

  // Telegraph ring: a clear, non-colour-dependent warning that a practice
  // strike is coming, paired with the "telegraph" sound cue.
  if (pad.striking && pad.phase === 'telegraph') {
    context.save();
    context.strokeStyle = '#e0a13a';
    context.lineWidth = 3;
    context.setLineDash([8, 6]);
    context.beginPath();
    context.arc(pad.x, baseY - PAD_HEIGHT + 40, 58, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }
}

/**
 * Draws the player's fighter. Poses are derived from the action state machine,
 * so what is on screen always matches what the engine believes is happening.
 */
function drawFighter(
  context: CanvasRenderingContext2D,
  state: CombatState,
  options: RenderOptions,
): void {
  const f = state.fighter;
  const animation = options.fighter?.animation;
  const gi = animation?.giColour ?? '#eef1f5';
  const belt = animation?.beltColour ?? '#101418';
  const accent = animation?.accentColour ?? '#4d86e8';

  const baseY = FLOOR_Y + 20 - f.y;

  context.save();

  // Contact shadow, which also communicates height while airborne.
  context.fillStyle = 'rgba(0, 0, 0, 0.35)';
  context.beginPath();
  context.ellipse(f.x, FLOOR_Y + 22, 30 - Math.min(14, f.y / 20), 8, 0, 0, Math.PI * 2);
  context.fill();

  context.translate(f.x, baseY);
  context.scale(f.facing, 1);

  const crouch = f.action === 'dodge' ? 14 : f.action === 'block' ? 6 : 0;
  const lean = f.action === 'strong' && f.phase === 'active' ? 10 : 0;

  // Legs.
  context.strokeStyle = gi;
  context.lineWidth = 15;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(-4, -50 + crouch);
  context.lineTo(-16, 0);
  context.moveTo(4, -50 + crouch);
  context.lineTo(18, 0);
  context.stroke();

  // Torso.
  const torsoTop = -FIGHTER_HEIGHT + 34 + crouch;
  context.fillStyle = gi;
  context.beginPath();
  context.moveTo(-19, -46 + crouch);
  context.lineTo(19, -46 + crouch);
  context.lineTo(15 + lean, torsoTop);
  context.lineTo(-15 + lean, torsoTop);
  context.closePath();
  context.fill();

  // Lapel and belt.
  context.strokeStyle = accent;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(0 + lean, torsoTop);
  context.lineTo(-6, -52 + crouch);
  context.stroke();

  context.fillStyle = belt;
  context.fillRect(-20, -52 + crouch, 40, 9);

  // Head. Positioned relative to the torso, which is in the translated space
  // established above — mixing in an absolute canvas coordinate here would put
  // the head off screen.
  const headRadius = 15;
  const headCentreY = torsoTop - headRadius - 3;
  context.fillStyle = gi;
  context.beginPath();
  context.arc(lean, headCentreY, headRadius, 0, Math.PI * 2);
  context.fill();

  // Headband in the fighter's accent colour, which also reads as facing.
  context.fillStyle = accent;
  context.fillRect(lean - headRadius, headCentreY - 8, headRadius * 2, 5);

  drawArms(context, state, { gi, accent, crouch, lean, torsoTop });

  // Evasion frames: a bright outline, so the dodge window is legible without
  // relying on the fighter's colour alone.
  if (f.invulnerable) {
    context.strokeStyle = '#6ea1f5';
    context.lineWidth = 3;
    context.strokeRect(-30, -FIGHTER_HEIGHT + 20, 60, FIGHTER_HEIGHT);
  }

  context.restore();

  // Guard indicator, drawn upright so it never mirrors with the fighter.
  if (f.action === 'block') {
    context.save();
    context.strokeStyle = '#4bbd8b';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(f.x, baseY - 70, 44, -Math.PI * 0.85, Math.PI * -0.15);
    context.stroke();
    context.restore();
  }
}

interface ArmStyle {
  readonly gi: string;
  readonly accent: string;
  readonly crouch: number;
  readonly lean: number;
  readonly torsoTop: number;
}

function drawArms(context: CanvasRenderingContext2D, state: CombatState, style: ArmStyle): void {
  const f = state.fighter;
  const shoulderY = style.torsoTop + 18;

  context.strokeStyle = style.gi;
  context.lineWidth = 13;
  context.lineCap = 'round';

  let leadX = 26;
  let leadY = shoulderY + 14;
  let rearX = -14;
  let rearY = shoulderY + 20;

  switch (f.action) {
    case 'light':
      if (f.phase === 'windup') {
        leadX = 12;
        leadY = shoulderY + 4;
      } else if (f.phase === 'active') {
        leadX = 78;
        leadY = shoulderY + 6;
      } else {
        leadX = 34;
        leadY = shoulderY + 12;
      }
      break;

    case 'strong':
      if (f.phase === 'windup') {
        leadX = -6;
        leadY = shoulderY - 10;
      } else if (f.phase === 'active') {
        leadX = 100;
        leadY = shoulderY + 10;
        rearX = -30;
      } else {
        leadX = 40;
        leadY = shoulderY + 18;
      }
      break;

    case 'block':
      leadX = 24;
      leadY = shoulderY - 8;
      rearX = 10;
      rearY = shoulderY + 2;
      break;

    case 'dodge':
      leadX = 16;
      leadY = shoulderY + 24;
      rearX = -22;
      rearY = shoulderY + 24;
      break;

    case 'bow': {
      // A standing bow: arms straight at the sides, torso folded forward.
      leadX = 14;
      leadY = shoulderY + 40;
      rearX = -12;
      rearY = shoulderY + 40;
      break;
    }

    case 'stagger':
      leadX = 8;
      leadY = shoulderY + 30;
      rearX = -24;
      rearY = shoulderY + 14;
      break;

    default:
      if (f.moving) {
        leadX = 22;
        leadY = shoulderY + 10;
      }
      break;
  }

  context.beginPath();
  context.moveTo(-8 + style.lean, shoulderY);
  context.lineTo(rearX, rearY);
  context.stroke();

  context.beginPath();
  context.moveTo(8 + style.lean, shoulderY);
  context.lineTo(leadX, leadY);
  context.stroke();

  // Fist marker on the active technique, so the reach of an attack is readable.
  if ((f.action === 'light' || f.action === 'strong') && f.phase === 'active') {
    context.fillStyle = style.accent;
    context.beginPath();
    context.arc(leadX, leadY, 9, 0, Math.PI * 2);
    context.fill();
  }
}

function drawPausedVeil(context: CanvasRenderingContext2D): void {
  context.save();
  context.fillStyle = 'rgba(8, 11, 17, 0.72)';
  context.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  context.fillStyle = '#eef2f8';
  context.font = '600 42px system-ui, sans-serif';
  context.textAlign = 'center';
  context.fillText('Paused', ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
  context.restore();
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}
