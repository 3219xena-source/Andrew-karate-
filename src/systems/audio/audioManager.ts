/**
 * Audio manager.
 *
 * Owns the single `AudioContext`, the master/music/effects gain graph, and the
 * procedural music player. Everything is created lazily on the first user
 * gesture because browsers block audio until then; before that point, calls are
 * accepted and ignored rather than throwing.
 *
 * Settings come from the save file and are applied to the gain graph
 * immediately, so muting is audible on the next frame rather than the next
 * sound.
 *
 *   masterGain ── musicGain ── (procedural music)
 *              └─ sfxGain   ── (one-shot effects)
 */

import type { AudioSettings } from '../../types/save.ts';
import { MusicPlayer } from './music.ts';
import { createNoiseBuffer, renderSfx, type SfxName } from './synth.ts';

type AudioContextConstructor = typeof AudioContext;

function resolveAudioContext(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null;
  const candidate =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  return candidate ?? null;
}

export class AudioManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private music: MusicPlayer | null = null;

  private settings: AudioSettings | null = null;
  /** Set once the user has interacted and the context has been created. */
  private unlocked = false;
  /** True when the current screen wants music playing. */
  private musicRequested = false;
  private failed = false;

  /** True when audio hardware is initialised and available. */
  get ready(): boolean {
    return this.unlocked && !this.failed;
  }

  /** True when the environment provides no usable Web Audio implementation. */
  get unsupported(): boolean {
    return this.failed || resolveAudioContext() === null;
  }

  /**
   * Creates the audio graph. Safe to call repeatedly; only the first call with
   * a real user gesture behind it does any work.
   */
  unlock(): void {
    if (this.unlocked || this.failed) return;

    const Constructor = resolveAudioContext();
    if (!Constructor) {
      this.failed = true;
      console.warn('[audio] Web Audio is not available; the game will run silently.');
      return;
    }

    try {
      const context = new Constructor();
      const masterGain = context.createGain();
      const musicGain = context.createGain();
      const sfxGain = context.createGain();

      musicGain.connect(masterGain);
      sfxGain.connect(masterGain);
      masterGain.connect(context.destination);

      this.context = context;
      this.masterGain = masterGain;
      this.musicGain = musicGain;
      this.sfxGain = sfxGain;
      this.noise = createNoiseBuffer(context, 1.2);
      this.music = new MusicPlayer(context, musicGain, this.noise);
      this.unlocked = true;

      this.applyGains();
      if (this.musicRequested) this.syncMusic();
    } catch (error) {
      this.failed = true;
      console.warn('[audio] could not initialise Web Audio; the game will run silently.', error);
    }

    void this.resume();
  }

  /** Resumes a context suspended by the browser (tab switch, autoplay policy). */
  async resume(): Promise<void> {
    if (!this.context || this.context.state !== 'suspended') return;
    try {
      await this.context.resume();
    } catch (error) {
      console.warn('[audio] could not resume the audio context', error);
    }
  }

  /** Applies new settings to the live gain graph and music state. */
  setSettings(settings: AudioSettings): void {
    this.settings = settings;
    if (!this.unlocked) return;
    this.applyGains();
    this.syncMusic();
  }

  /** Requests that background music play on the current screen. */
  setMusicRequested(requested: boolean): void {
    this.musicRequested = requested;
    if (!this.unlocked) return;
    this.syncMusic();
  }

  /** Plays a one-shot effect. Ignored when audio is unavailable or muted. */
  play(name: SfxName): void {
    if (!this.unlocked || this.failed) return;
    if (!this.context || !this.sfxGain || !this.noise) return;
    if (!this.settings?.masterEnabled || !this.settings.sfxEnabled) return;
    if (this.settings.sfxVolume <= 0) return;

    void this.resume();
    try {
      renderSfx(this.context, this.sfxGain, name, this.noise);
    } catch (error) {
      // A failed sound must never interrupt gameplay.
      console.warn(`[audio] could not play "${name}"`, error);
    }
  }

  /** Releases audio resources. Called when the app unmounts. */
  dispose(): void {
    this.music?.stop();
    this.music = null;
    if (this.context) {
      void this.context.close().catch(() => {
        /* Closing a context that is already closed is not an error worth surfacing. */
      });
    }
    this.context = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.unlocked = false;
  }

  private applyGains(): void {
    const settings = this.settings;
    if (!settings || !this.masterGain || !this.musicGain || !this.sfxGain || !this.context) return;

    const now = this.context.currentTime;
    const master = settings.masterEnabled ? 1 : 0;
    const musicLevel = settings.musicEnabled ? settings.musicVolume : 0;
    const sfxLevel = settings.sfxEnabled ? settings.sfxVolume : 0;

    // Short ramps rather than instant jumps, which would click.
    this.masterGain.gain.setTargetAtTime(master, now, 0.015);
    this.musicGain.gain.setTargetAtTime(musicLevel, now, 0.03);
    this.sfxGain.gain.setTargetAtTime(sfxLevel, now, 0.015);
  }

  /** Starts or stops the generator so muted music costs no CPU. */
  private syncMusic(): void {
    if (!this.music) return;
    const settings = this.settings;
    const shouldPlay =
      this.musicRequested === true &&
      settings?.masterEnabled === true &&
      settings.musicEnabled === true &&
      settings.musicVolume > 0;

    if (shouldPlay && !this.music.playing) {
      void this.resume();
      this.music.start();
    } else if (!shouldPlay && this.music.playing) {
      this.music.stop();
    }
  }
}

/** The application's single audio manager. */
export const audioManager = new AudioManager();

export type { SfxName };
