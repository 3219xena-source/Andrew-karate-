/**
 * The master sound toggle.
 *
 * Present in the header of every major screen, as required by the audio spec.
 * Its state is written to the save file immediately, so it survives a refresh.
 */

import { useGameStore } from '../../state/gameStore.ts';
import { Button } from './Button.tsx';

export function AudioButton() {
  const enabled = useGameStore((state) => state.audio.masterEnabled);
  const toggle = useGameStore((state) => state.toggleMasterAudio);

  return (
    <Button
      size="icon"
      variant="ghost"
      // The un-mute click should be audible; the mute click should not linger.
      sound={enabled ? null : 'menu-select'}
      onClick={toggle}
      aria-pressed={enabled}
      title={enabled ? 'Sound is on. Select to mute.' : 'Sound is off. Select to unmute.'}
      data-testid="audio-toggle"
    >
      <span aria-hidden="true">{enabled ? '🔊' : '🔇'}</span>
      <span className="visually-hidden">{enabled ? 'Sound on' : 'Sound off'}</span>
    </Button>
  );
}
