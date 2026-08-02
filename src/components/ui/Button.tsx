/**
 * The game's only button primitive.
 *
 * Every clickable control in the interface routes through here so that focus
 * styling, sizing and the menu click sound stay consistent. Sound is played on
 * activation rather than on hover, so keyboard and pointer users get identical
 * feedback.
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { audioManager } from '../../systems/audio/audioManager.ts';
import type { SfxName } from '../../systems/audio/synth.ts';

export type ButtonVariant = 'default' | 'primary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: 'default' | 'large' | 'icon';
  /** Effect played on activation. Pass `null` for a silent control. */
  readonly sound?: SfxName | null;
  readonly children: ReactNode;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: '',
  primary: 'button--primary',
  ghost: 'button--ghost',
};

export function Button({
  variant = 'default',
  size = 'default',
  sound = 'menu-select',
  className,
  onClick,
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    'button',
    VARIANT_CLASS[variant],
    size === 'large' ? 'button--large' : '',
    size === 'icon' ? 'button--icon' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      onClick={(event) => {
        if (sound) audioManager.play(sound);
        onClick?.(event);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
