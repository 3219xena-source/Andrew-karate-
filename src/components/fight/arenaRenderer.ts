/**
 * Arena renderer.
 *
 * A pure drawing function: given a 2D context, a match state and a venue, it
 * paints one frame. It holds no state of its own, so the fight screen can call
 * it at any time and the simulation stays the single source of truth.
 *
 * All artwork is drawn procedurally from the venue palette and each fighter's
 * configured colours — there are no image files anywhere in this build. The
 * scene is composed in explicit layers so each can be reasoned about
 * separately:
 *
 *   back wall → venue motif → crowd → banners → floor → referee →
 *   fighters → impact effects
 *
 * Presentation contract: sport karate. Impact effects are light and geometric.
 * There is no blood, no injury depiction and no gore of any kind.
 */

import type { Fighter } from '../../types/fighter.ts';
import type { Venue } from '../../types/venue.ts';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  CROUCH_HEIGHT,
  FIGHTER_HEIGHT,
} from '../../systems/match/constants.ts';
import type { FighterSim, MatchState } from '../../systems/match/types.ts';

/**
 * Vertical composition of the arena, in arena units (ARENA_HEIGHT is 560).
 *
 *     0 ──────────────── lighting and hanging banners
 *   150 ──────────────── venue motif (the back wall's architecture)
 *   196 ──────────────── crowd, three rows receding upwards
 *   300 ──────────────── barrier rail at the front of the seating
 *   330 ── FLOOR_Y ───── the mat begins
 *   470 ──────────────── the fighters' foot line, well down the mat
 *   560 ──────────────── the front apron of the mat
 *
 * The fighters stand IN FRONT of the barrier, not among the crowd, and there
 * is real mat both behind and in front of them — which is what gives the scene
 * depth and keeps the two competitors the clearest thing on screen.
 */
const FLOOR_Y = 330;
/** Distance from the floor line down to where the fighters actually stand. */
const FIGHTER_FOOT_OFFSET = 140;
/** Y coordinate of the fighters' feet when grounded. */
const FOOT_LINE = FLOOR_Y + FIGHTER_FOOT_OFFSET;
/** Top of the crowd barrier. */
const BARRIER_Y = 300;

/** A short-lived impact mark drawn over the fighters. */
export interface ImpactEffect {
  x: number;
  y: number;
  /** Seconds remaining. */
  life: number;
  readonly maxLife: number;
  readonly kind: 'hit' | 'blocked' | 'dodged' | 'power';
  readonly colour: string;
}

export interface ArenaRenderOptions {
  readonly venue: Venue;
  readonly redFighter: Fighter;
  readonly blueFighter: Fighter;
  /** Club short names, printed on the two flanking banners. */
  readonly redLabel: string;
  readonly blueLabel: string;
  readonly effects: readonly ImpactEffect[];
  /** Seconds since the fight screen opened; drives ambient motion only. */
  readonly elapsed: number;
  readonly reducedMotion: boolean;
  /** Screen shake magnitude, 0..1. Suppressed when the player turns it off. */
  readonly shake: number;
  readonly paused: boolean;
}

export function renderArena(
  context: CanvasRenderingContext2D,
  state: MatchState,
  options: ArenaRenderOptions,
): void {
  const { width, height } = context.canvas;
  const scale = Math.min(width / ARENA_WIDTH, height / ARENA_HEIGHT);

  context.save();
  context.clearRect(0, 0, width, height);

  const shakeX = options.shake > 0 ? (Math.sin(options.elapsed * 90) * options.shake * 7) : 0;
  const shakeY = options.shake > 0 ? (Math.cos(options.elapsed * 77) * options.shake * 5) : 0;

  context.setTransform(
    scale,
    0,
    0,
    scale,
    (width - ARENA_WIDTH * scale) / 2 + shakeX,
    (height - ARENA_HEIGHT * scale) / 2 + shakeY,
  );

  drawBackWall(context, options);
  drawMotif(context, options);
  drawCrowd(context, options);
  drawBanners(context, options);
  drawFloor(context, options);
  drawReferee(context, state);

  // The fighter further from the camera is drawn first so the nearer one reads
  // clearly in front during an exchange.
  const [back, front] =
    state.red.y >= state.blue.y ? [state.blue, state.red] : [state.red, state.blue];
  drawFighter(context, back, back.corner === 'red' ? options.redFighter : options.blueFighter);
  drawFighter(context, front, front.corner === 'red' ? options.redFighter : options.blueFighter);

  drawEffects(context, options.effects);

  if (options.paused) drawPausedVeil(context);

  context.restore();
}

function drawBackWall(context: CanvasRenderingContext2D, options: ArenaRenderOptions): void {
  const { palette } = options.venue;
  const wall = context.createLinearGradient(0, 0, 0, FLOOR_Y);
  wall.addColorStop(0, palette.wallTop);
  wall.addColorStop(1, palette.wallBottom);
  context.fillStyle = wall;
  context.fillRect(0, 0, ARENA_WIDTH, FLOOR_Y);

  // Lighting rigs: three soft pools across the ceiling.
  for (let i = 0; i < 3; i += 1) {
    const x = ARENA_WIDTH * (0.22 + i * 0.28);
    const glow = context.createRadialGradient(x, 0, 10, x, 0, 260);
    glow.addColorStop(0, hexToRgba(palette.accent, 0.22));
    glow.addColorStop(1, hexToRgba(palette.accent, 0));
    context.fillStyle = glow;
    context.fillRect(x - 260, 0, 520, 300);
  }
}

/** The motif is what makes each venue recognisable at a glance. */
function drawMotif(context: CanvasRenderingContext2D, options: ArenaRenderOptions): void {
  const { palette, motif } = options.venue;
  context.save();
  context.strokeStyle = hexToRgba(palette.trim, 0.34);
  context.fillStyle = hexToRgba(palette.trim, 0.12);
  context.lineWidth = 3;

  switch (motif) {
    case 'mountain': {
      // A stylised mountain ridge behind the seating.
      context.beginPath();
      context.moveTo(0, 250);
      context.lineTo(180, 138);
      context.lineTo(300, 196);
      context.lineTo(470, 104);
      context.lineTo(640, 190);
      context.lineTo(820, 126);
      context.lineTo(1010, 204);
      context.lineTo(ARENA_WIDTH, 158);
      context.lineTo(ARENA_WIDTH, 270);
      context.lineTo(0, 270);
      context.closePath();
      context.fill();
      context.stroke();
      break;
    }
    case 'heritage-arches': {
      for (let i = 0; i < 6; i += 1) {
        const x = 80 + i * 190;
        context.beginPath();
        context.moveTo(x, 265);
        context.lineTo(x, 190);
        context.arc(x + 60, 190, 60, Math.PI, 0);
        context.lineTo(x + 120, 265);
        context.stroke();
      }
      break;
    }
    case 'coastal-windows': {
      for (let i = 0; i < 5; i += 1) {
        const x = 70 + i * 225;
        context.fillRect(x, 150, 170, 115);
        context.strokeRect(x, 150, 170, 115);
        context.beginPath();
        context.moveTo(x + 85, 150);
        context.lineTo(x + 85, 265);
        context.moveTo(x, 208);
        context.lineTo(x + 170, 208);
        context.stroke();
      }
      break;
    }
    case 'industrial-trusses': {
      for (let i = 0; i < 7; i += 1) {
        const x = i * 175;
        context.beginPath();
        context.moveTo(x, 158);
        context.lineTo(x + 88, 236);
        context.lineTo(x + 175, 158);
        context.stroke();
      }
      context.beginPath();
      context.moveTo(0, 236);
      context.lineTo(ARENA_WIDTH, 236);
      context.stroke();
      break;
    }
    case 'timber-hall': {
      for (let i = 0; i < 10; i += 1) {
        const x = i * 122;
        context.beginPath();
        context.moveTo(x, 150);
        context.lineTo(x, 265);
        context.stroke();
      }
      context.beginPath();
      context.moveTo(0, 200);
      context.lineTo(ARENA_WIDTH, 200);
      context.stroke();
      break;
    }
    case 'alpine-lodge': {
      context.beginPath();
      context.moveTo(0, 235);
      context.lineTo(ARENA_WIDTH / 2, 140);
      context.lineTo(ARENA_WIDTH, 235);
      context.lineTo(ARENA_WIDTH, 270);
      context.lineTo(0, 270);
      context.closePath();
      context.fill();
      context.stroke();
      break;
    }
  }
  context.restore();
}

/**
 * Crowd silhouettes. Deterministic: the same venue always draws the same
 * crowd, so the arena does not shimmer between frames.
 */
function drawCrowd(context: CanvasRenderingContext2D, options: ArenaRenderOptions): void {
  const { palette } = options.venue;
  const rows = 3;
  context.save();
  // Rows recede upwards: the nearest row is lowest, largest and darkest.
  for (let row = rows - 1; row >= 0; row -= 1) {
    const y = 208 + row * 30;
    const spacing = 30 + row * 4;
    const radius = 11 + row * 1.5;
    context.fillStyle = hexToRgba(palette.crowd, 0.6 + (rows - row) * 0.12);
    for (let x = 16; x < ARENA_WIDTH; x += spacing) {
      // A slow, low-amplitude sway reads as a live crowd without distraction.
      const sway = options.reducedMotion
        ? 0
        : Math.sin(options.elapsed * 1.6 + x * 0.05 + row) * 2;
      context.beginPath();
      context.arc(x, y + sway, radius, 0, Math.PI * 2);
      context.fill();
      context.fillRect(x - radius, y + sway, radius * 2, 30);
    }
  }

  // The barrier at the front of the seating. Everything below it is the mat,
  // so the fighters always read as being in front of the crowd, never in it.
  const barrier = context.createLinearGradient(0, BARRIER_Y, 0, FLOOR_Y);
  barrier.addColorStop(0, hexToRgba(palette.crowd, 0.98));
  barrier.addColorStop(1, hexToRgba(palette.wallBottom, 1));
  context.fillStyle = barrier;
  context.fillRect(0, BARRIER_Y, ARENA_WIDTH, FLOOR_Y - BARRIER_Y);
  context.strokeStyle = hexToRgba(palette.trim, 0.55);
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(0, BARRIER_Y);
  context.lineTo(ARENA_WIDTH, BARRIER_Y);
  context.stroke();
  context.restore();
}

function drawBanners(context: CanvasRenderingContext2D, options: ArenaRenderOptions): void {
  const { palette, bannerText } = options.venue;
  const sway = options.reducedMotion ? 0 : Math.sin(options.elapsed * 0.8) * 2.5;

  // Two club-coloured banners flanking a central championship banner.
  const banners: Array<{ x: number; w: number; colour: string; text: string; size: number }> = [
    {
      x: 84,
      w: 168,
      colour: options.redFighter.animation.accentColour,
      text: options.redLabel.toUpperCase(),
      size: 19,
    },
    {
      x: ARENA_WIDTH / 2 - 170,
      w: 340,
      colour: palette.trim,
      text: bannerText,
      size: 21,
    },
    {
      x: ARENA_WIDTH - 252,
      w: 168,
      colour: options.blueFighter.animation.accentColour,
      text: options.blueLabel.toUpperCase(),
      size: 19,
    },
  ];

  for (const banner of banners) {
    context.save();
    context.translate(0, sway);

    // A hanging rail, so the banners read as suspended rather than floating.
    context.strokeStyle = hexToRgba(palette.accent, 0.7);
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(banner.x + 14, 18);
    context.lineTo(banner.x + 14, 30);
    context.moveTo(banner.x + banner.w - 14, 18);
    context.lineTo(banner.x + banner.w - 14, 30);
    context.stroke();

    context.fillStyle = hexToRgba(banner.colour, 0.62);
    context.fillRect(banner.x, 30, banner.w, 92);
    context.strokeStyle = palette.accent;
    context.lineWidth = 3;
    context.strokeRect(banner.x, 30, banner.w, 92);

    context.fillStyle = '#ffffff';
    context.font = `600 ${banner.size}px system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(banner.text, banner.x + banner.w / 2, 76, banner.w - 22);
    context.restore();
  }
}

function drawFloor(context: CanvasRenderingContext2D, options: ArenaRenderOptions): void {
  const { palette } = options.venue;
  const floor = context.createLinearGradient(0, FLOOR_Y, 0, ARENA_HEIGHT);
  floor.addColorStop(0, palette.matPrimary);
  floor.addColorStop(1, palette.matSecondary);
  context.fillStyle = floor;
  context.fillRect(0, FLOOR_Y, ARENA_WIDTH, ARENA_HEIGHT - FLOOR_Y);

  // Competition-area boundary and centre line. The box is inset so the
  // fighters' foot line sits inside it, which is what makes them read as
  // standing on the mat rather than in front of it.
  context.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  context.lineWidth = 3;
  context.strokeRect(52, FLOOR_Y + 56, ARENA_WIDTH - 104, ARENA_HEIGHT - FLOOR_Y - 96);
  context.beginPath();
  context.moveTo(ARENA_WIDTH / 2, FLOOR_Y + 60);
  context.lineTo(ARENA_WIDTH / 2, ARENA_HEIGHT - 44);
  context.stroke();

  // The apron in front of the mat.
  context.fillStyle = 'rgba(255, 255, 255, 0.28)';
  context.fillRect(0, FLOOR_Y, ARENA_WIDTH, 4);
}

/**
 * The match official. Positioned at the back of the mat so they never obstruct
 * an exchange between the two fighters.
 */
function drawReferee(context: CanvasRenderingContext2D, state: MatchState): void {
  // Positioned at the back-left corner of the mat and drawn small, so the
  // official is present and readable but can never obstruct an exchange
  // between the two competitors, who fight far forward of this line.
  const x = 150;
  const baseY = FLOOR_Y + 34;
  // Arms raised on 'ready' and when a round has been decided.
  const signalling = state.phase !== 'fighting';

  context.save();
  context.translate(x, baseY);
  context.scale(0.46, 0.46);

  context.fillStyle = 'rgba(0,0,0,0.3)';
  context.beginPath();
  context.ellipse(0, 6, 26, 7, 0, 0, Math.PI * 2);
  context.fill();

  // White shirt, dark trousers: an unmistakable official silhouette.
  context.strokeStyle = '#25303f';
  context.lineWidth = 14;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(-6, -46);
  context.lineTo(-14, 0);
  context.moveTo(6, -46);
  context.lineTo(14, 0);
  context.stroke();

  context.fillStyle = '#e8edf4';
  context.beginPath();
  context.moveTo(-20, -44);
  context.lineTo(20, -44);
  context.lineTo(16, -104);
  context.lineTo(-16, -104);
  context.closePath();
  context.fill();

  context.strokeStyle = '#e8edf4';
  context.lineWidth = 11;
  context.beginPath();
  if (signalling) {
    context.moveTo(-14, -96);
    context.lineTo(-40, -140);
    context.moveTo(14, -96);
    context.lineTo(40, -140);
  } else {
    context.moveTo(-14, -96);
    context.lineTo(-30, -54);
    context.moveTo(14, -96);
    context.lineTo(30, -54);
  }
  context.stroke();

  context.fillStyle = '#caa07c';
  context.beginPath();
  context.arc(0, -118, 15, 0, Math.PI * 2);
  context.fill();

  context.restore();
}

/** Draws one fighter, posed from the engine's action state. */
function drawFighter(
  context: CanvasRenderingContext2D,
  sim: FighterSim,
  record: Fighter,
): void {
  const look = record.animation;
  const baseY = FOOT_LINE - sim.y;
  const crouch = sim.crouching ? FIGHTER_HEIGHT - CROUCH_HEIGHT : 0;
  const knockedDown = sim.action === 'knockdown' || sim.action === 'defeated';

  const widthScale = look.build === 'heavy' ? 1.16 : look.build === 'light' ? 0.88 : 1;

  context.save();

  // Contact shadow, which also communicates height while airborne.
  context.fillStyle = 'rgba(0, 0, 0, 0.4)';
  context.beginPath();
  context.ellipse(sim.x, FOOT_LINE + 3, 34 - Math.min(16, sim.y / 22), 9, 0, 0, Math.PI * 2);
  context.fill();

  context.translate(sim.x, baseY);
  if (knockedDown) {
    // A respectful "unable to continue" pose: seated, guard down. Not injury.
    context.rotate(sim.facing * -0.28);
  }
  context.scale(sim.facing * widthScale, 1);

  const torsoTop = -FIGHTER_HEIGHT + 36 + crouch;
  const hipY = -48 + crouch * 0.7;

  // Legs.
  context.strokeStyle = look.giColour;
  context.lineWidth = 17;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(-5, hipY);
  context.lineTo(-19, 0);
  context.moveTo(5, hipY);
  context.lineTo(21, 0);
  context.stroke();

  // Torso.
  const lean = sim.action === 'attack' && sim.phase === 'active' ? 11 : 0;
  context.fillStyle = look.giColour;
  context.beginPath();
  context.moveTo(-21, hipY + 2);
  context.lineTo(21, hipY + 2);
  context.lineTo(17 + lean, torsoTop);
  context.lineTo(-17 + lean, torsoTop);
  context.closePath();
  context.fill();

  // Lapel and club-coloured trim.
  context.strokeStyle = look.accentColour;
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(lean, torsoTop);
  context.lineTo(-7, hipY - 4);
  context.stroke();

  // Belt.
  context.fillStyle = look.beltColour;
  context.fillRect(-22, hipY - 8, 44, 10);

  // Head.
  const headRadius = 16;
  const headCentreY = torsoTop - headRadius - 4;
  context.fillStyle = look.skinTone;
  context.beginPath();
  context.arc(lean, headCentreY, headRadius, 0, Math.PI * 2);
  context.fill();
  // Hair, drawn as a cap over the upper skull.
  context.fillStyle = look.hairColour;
  context.beginPath();
  context.arc(lean, headCentreY - 3, headRadius, Math.PI, 0);
  context.fill();

  drawArms(context, sim, look, torsoTop, lean);

  // Evasion frames read as a bright outline, so the dodge window is legible
  // without depending on colour alone.
  if (sim.invulnerable) {
    context.strokeStyle = '#ffffff';
    context.lineWidth = 3;
    context.setLineDash([9, 7]);
    context.strokeRect(-34, torsoTop - 40, 68, FIGHTER_HEIGHT + 20);
    context.setLineDash([]);
  }

  context.restore();

  // Guard indicator, drawn upright so it never mirrors with the fighter.
  if (sim.action === 'block') {
    context.save();
    context.strokeStyle = '#8fe0bb';
    context.lineWidth = 4;
    context.beginPath();
    context.arc(sim.x, baseY - 78 + crouch * 0.6, 48, -Math.PI * 0.88, Math.PI * -0.12);
    context.stroke();
    context.restore();
  }
}

function drawArms(
  context: CanvasRenderingContext2D,
  sim: FighterSim,
  look: Fighter['animation'],
  torsoTop: number,
  lean: number,
): void {
  const shoulderY = torsoTop + 20;
  context.strokeStyle = look.giColour;
  context.lineWidth = 14;
  context.lineCap = 'round';

  let leadX = 30;
  let leadY = shoulderY + 16;
  let rearX = -16;
  let rearY = shoulderY + 22;
  let showFist = false;

  if (sim.action === 'attack' && sim.attack) {
    const extending = sim.phase === 'active';
    const winding = sim.phase === 'windup';
    switch (sim.attack) {
      case 'lightPunch':
        leadX = winding ? 14 : extending ? 86 : 38;
        leadY = shoulderY + 6;
        showFist = extending;
        break;
      case 'strongPunch':
      case 'powerAttack':
        leadX = winding ? -8 : extending ? 108 : 44;
        leadY = shoulderY + 8;
        rearX = extending ? -34 : -16;
        showFist = extending;
        break;
      case 'lightKick':
      case 'strongKick':
        // Kicks are drawn on the lead leg; arms stay in a covering guard.
        leadX = 22;
        leadY = shoulderY + 2;
        rearX = 8;
        rearY = shoulderY + 10;
        if (extending) {
          context.save();
          context.strokeStyle = look.giColour;
          context.lineWidth = 17;
          context.beginPath();
          context.moveTo(4, -48);
          context.lineTo(sim.attack === 'strongKick' ? 128 : 110, -66);
          context.stroke();
          context.fillStyle = look.accentColour;
          context.beginPath();
          context.arc(sim.attack === 'strongKick' ? 128 : 110, -66, 11, 0, Math.PI * 2);
          context.fill();
          context.restore();
        }
        break;
      case 'crouchAttack':
        leadX = winding ? 12 : extending ? 92 : 36;
        leadY = shoulderY + 34;
        showFist = extending;
        break;
      case 'jumpAttack':
        leadX = extending ? 96 : 30;
        leadY = shoulderY + 26;
        showFist = extending;
        break;
    }
  } else {
    switch (sim.action) {
      case 'block':
        leadX = 26;
        leadY = shoulderY - 10;
        rearX = 12;
        rearY = shoulderY;
        break;
      case 'dodge':
        leadX = 18;
        leadY = shoulderY + 28;
        rearX = -24;
        rearY = shoulderY + 28;
        break;
      case 'hitstun':
        leadX = 6;
        leadY = shoulderY + 34;
        rearX = -28;
        rearY = shoulderY + 16;
        break;
      case 'knockdown':
      case 'defeated':
        leadX = 14;
        leadY = shoulderY + 42;
        rearX = -14;
        rearY = shoulderY + 42;
        break;
      default:
        if (sim.moving) {
          leadX = 26;
          leadY = shoulderY + 12;
        }
        break;
    }
  }

  context.beginPath();
  context.moveTo(-9 + lean, shoulderY);
  context.lineTo(rearX, rearY);
  context.stroke();

  context.beginPath();
  context.moveTo(9 + lean, shoulderY);
  context.lineTo(leadX, leadY);
  context.stroke();

  if (showFist) {
    context.fillStyle = look.accentColour;
    context.beginPath();
    context.arc(leadX, leadY, 11, 0, Math.PI * 2);
    context.fill();
  }
}

/** Light, geometric impact marks. Deliberately abstract — never injury art. */
function drawEffects(context: CanvasRenderingContext2D, effects: readonly ImpactEffect[]): void {
  for (const effect of effects) {
    const progress = 1 - effect.life / effect.maxLife;
    const alpha = Math.max(0, 1 - progress);
    context.save();
    context.globalAlpha = alpha;
    context.translate(effect.x, effect.y);

    if (effect.kind === 'blocked') {
      // A guard reads as a short arc, not a burst.
      context.strokeStyle = effect.colour;
      context.lineWidth = 5;
      context.beginPath();
      context.arc(0, 0, 20 + progress * 24, -Math.PI * 0.7, Math.PI * 0.7);
      context.stroke();
    } else if (effect.kind === 'dodged') {
      // Evasion reads as motion lines, with no contact at all.
      context.strokeStyle = effect.colour;
      context.lineWidth = 3;
      for (let i = -1; i <= 1; i += 1) {
        context.beginPath();
        context.moveTo(-30 - progress * 26, i * 16);
        context.lineTo(-6 - progress * 12, i * 16);
        context.stroke();
      }
    } else {
      const spokes = effect.kind === 'power' ? 10 : 6;
      const radius = (effect.kind === 'power' ? 34 : 20) + progress * 34;
      context.strokeStyle = effect.colour;
      context.lineWidth = effect.kind === 'power' ? 6 : 4;
      for (let i = 0; i < spokes; i += 1) {
        const angle = (i / spokes) * Math.PI * 2;
        context.beginPath();
        context.moveTo(Math.cos(angle) * radius * 0.45, Math.sin(angle) * radius * 0.45);
        context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        context.stroke();
      }
    }
    context.restore();
  }
}

function drawPausedVeil(context: CanvasRenderingContext2D): void {
  context.save();
  context.fillStyle = 'rgba(8, 11, 17, 0.76)';
  context.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  context.fillStyle = '#eef2f8';
  context.font = '600 46px system-ui, sans-serif';
  context.textAlign = 'center';
  context.fillText('Paused', ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
  context.restore();
}

/** Converts a #rrggbb colour and an alpha into an rgba() string. */
function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  const r = Number.parseInt(full.slice(0, 2), 16) || 0;
  const g = Number.parseInt(full.slice(2, 4), 16) || 0;
  const b = Number.parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
