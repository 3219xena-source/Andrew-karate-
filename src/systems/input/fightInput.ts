/**
 * Keyboard input for the fight screen.
 *
 * Translates physical keys into the engine's abstract `MatchInput`. Bindings
 * live in one table so a remapping screen can be added without touching the
 * combat code, and the on-screen control guide is rendered from the same table
 * so it cannot drift out of date.
 *
 * Only bound keys have their default behaviour suppressed, and keys are ignored
 * entirely while a menu control has focus — so Space still activates a focused
 * button and the page never scrolls under the player mid-round.
 */

import type { MatchInput } from '../match/types.ts';
import { NEUTRAL_MATCH_INPUT } from '../match/types.ts';

export type FightAction = keyof MatchInput;

/** Physical `KeyboardEvent.code` values mapped to game actions. */
export const FIGHT_BINDINGS: Readonly<Record<string, FightAction>> = {
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyJ: 'lightPunch',
  KeyK: 'strongPunch',
  KeyU: 'lightKick',
  KeyI: 'strongKick',
  KeyL: 'block',
  ShiftLeft: 'dodge',
  ShiftRight: 'dodge',
  Space: 'power',
};

/** Human-readable control guide, rendered by the fight screen and Settings. */
export const FIGHT_CONTROL_GUIDE: ReadonlyArray<{ keys: string; action: string }> = [
  { keys: 'A / D  or  ← / →', action: 'Move left and right' },
  { keys: 'W / ↑', action: 'Jump' },
  { keys: 'S / ↓', action: 'Crouch' },
  { keys: 'J', action: 'Light punch' },
  { keys: 'K', action: 'Strong punch' },
  { keys: 'U', action: 'Light kick' },
  { keys: 'I', action: 'Strong kick' },
  { keys: 'L (hold)', action: 'Block' },
  { keys: 'Shift', action: 'Dodge' },
  { keys: 'Space', action: 'Power attack (needs a full meter)' },
  { keys: 'P / Esc', action: 'Pause' },
];

const INTERACTIVE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A']);

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (INTERACTIVE_TAGS.has(target.tagName)) return true;
  const role = target.getAttribute('role');
  return role === 'button' || role === 'slider' || role === 'link';
}

export class FightInputManager {
  private readonly held = new Set<FightAction>();
  private attached = false;
  private target: (Window & typeof globalThis) | null = null;

  /** Called when the pause key is pressed. */
  onPause: (() => void) | null = null;

  attach(target: Window & typeof globalThis): void {
    if (this.attached) return;
    this.target = target;
    this.attached = true;
    target.addEventListener('keydown', this.handleKeyDown);
    target.addEventListener('keyup', this.handleKeyUp);
    target.addEventListener('blur', this.handleBlur);
  }

  detach(): void {
    if (!this.attached || !this.target) return;
    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
    this.target.removeEventListener('blur', this.handleBlur);
    this.attached = false;
    this.target = null;
    this.held.clear();
  }

  /** Builds an immutable snapshot of the currently held actions. */
  snapshot(): MatchInput {
    if (this.held.size === 0) return NEUTRAL_MATCH_INPUT;
    return {
      left: this.held.has('left'),
      right: this.held.has('right'),
      up: this.held.has('up'),
      down: this.held.has('down'),
      lightPunch: this.held.has('lightPunch'),
      strongPunch: this.held.has('strongPunch'),
      lightKick: this.held.has('lightKick'),
      strongKick: this.held.has('strongKick'),
      block: this.held.has('block'),
      dodge: this.held.has('dodge'),
      power: this.held.has('power'),
    };
  }

  clear(): void {
    this.held.clear();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    // Escape must always pause, even from a focused control, so the player is
    // never trapped mid-round.
    if (isInteractiveTarget(event.target) && event.code !== 'Escape') return;

    if (event.code === 'Escape' || event.code === 'KeyP') {
      event.preventDefault();
      this.held.clear();
      this.onPause?.();
      return;
    }

    const action = FIGHT_BINDINGS[event.code];
    if (!action) return;
    // Suppressing the default here is what stops the page scrolling on the
    // arrow keys and Space while a round is live.
    event.preventDefault();
    if (event.repeat) return;
    this.held.add(action);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const action = FIGHT_BINDINGS[event.code];
    if (!action) return;
    // Always release, even if the key-up lands on a focused control, so a key
    // can never stay stuck down.
    this.held.delete(action);
  };

  private readonly handleBlur = (): void => {
    this.held.clear();
  };
}
