/**
 * Keyboard input manager for the training dojo.
 *
 * Translates physical keys into the engine's abstract `InputState`. Bindings
 * live in one table so a remapping screen can be added in Stage 2 without
 * touching the combat code.
 *
 * Only keys that are actually bound have their default behaviour suppressed, so
 * browser shortcuts and — importantly — Tab-based focus navigation keep working
 * while the dojo is open.
 */

import type { InputState } from '../combat/types.ts';
import { NEUTRAL_INPUT } from '../combat/types.ts';

export type GameAction = keyof InputState;

/** Physical `KeyboardEvent.code` values mapped to game actions. */
export const KEY_BINDINGS: Readonly<Record<string, GameAction>> = {
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyW: 'jump',
  ArrowUp: 'jump',
  Space: 'jump',
  KeyJ: 'light',
  KeyK: 'strong',
  KeyL: 'block',
  ShiftLeft: 'dodge',
  ShiftRight: 'dodge',
  KeyB: 'bow',
};

/** Human-readable control guide, rendered by the dojo and the settings screen. */
export const CONTROL_GUIDE: ReadonlyArray<{ keys: string; action: string }> = [
  { keys: 'A / D  or  ← / →', action: 'Move left and right' },
  { keys: 'W / ↑ / Space', action: 'Jump' },
  { keys: 'J', action: 'Light attack' },
  { keys: 'K', action: 'Strong attack' },
  { keys: 'L (hold)', action: 'Block' },
  { keys: 'Shift', action: 'Dodge' },
  { keys: 'B', action: 'Bow' },
  { keys: 'R', action: 'Reset position' },
  { keys: 'Esc / P', action: 'Pause' },
];

export class InputManager {
  private readonly held = new Set<GameAction>();
  private attached = false;
  private target: (Window & typeof globalThis) | null = null;

  /** Called when the pause key is pressed. */
  onPause: (() => void) | null = null;
  /** Called when the reset-position key is pressed. */
  onReset: (() => void) | null = null;

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
  snapshot(): InputState {
    if (this.held.size === 0) return NEUTRAL_INPUT;
    return {
      left: this.held.has('left'),
      right: this.held.has('right'),
      jump: this.held.has('jump'),
      light: this.held.has('light'),
      strong: this.held.has('strong'),
      block: this.held.has('block'),
      dodge: this.held.has('dodge'),
      bow: this.held.has('bow'),
    };
  }

  /** Clears all held keys. Used when the dojo is paused or loses focus. */
  clear(): void {
    this.held.clear();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    // Escape must always pause, even from a focused control, so the player is
    // never trapped. Everything else defers to the focused widget.
    if (isInteractiveTarget(event.target) && event.code !== 'Escape') return;

    if (event.code === 'Escape' || event.code === 'KeyP') {
      event.preventDefault();
      this.held.clear();
      this.onPause?.();
      return;
    }

    if (event.code === 'KeyR') {
      event.preventDefault();
      this.onReset?.();
      return;
    }

    const action = KEY_BINDINGS[event.code];
    if (!action) return;
    event.preventDefault();
    if (event.repeat) return;
    this.held.add(action);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const action = KEY_BINDINGS[event.code];
    if (!action) return;
    // Always release, even if the key-up lands on a control that was focused
    // mid-press, so a key can never stay stuck down.
    this.held.delete(action);
  };

  /** Dropping every key on blur prevents a "stuck run" after an alt-tab. */
  private readonly handleBlur = (): void => {
    this.held.clear();
  };
}

const INTERACTIVE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A']);

/**
 * True when the event target is a control the player is operating with the
 * keyboard. Game keys are not swallowed in that case, so Space still activates
 * a focused button and the arrow keys still drive a focused volume slider.
 */
function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (INTERACTIVE_TAGS.has(target.tagName)) return true;
  const role = target.getAttribute('role');
  return role === 'button' || role === 'slider' || role === 'link';
}
