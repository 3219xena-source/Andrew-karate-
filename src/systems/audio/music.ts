/**
 * Procedural background music.
 *
 * An original martial-arts-inspired instrumental generated at runtime. The
 * composition below is written for this project: a modal pentatonic melody over
 * a drone and a soft frame-drum pulse. It deliberately does not reproduce,
 * quote or imitate any existing recording or composition.
 *
 * The scheduler uses the standard look-ahead pattern — a timer wakes
 * periodically and schedules the notes falling inside the next window — so
 * timing comes from the audio clock rather than from `setInterval` jitter.
 */

import { playNoise, playTone } from './synth.ts';

/** Seconds of audio scheduled ahead of the playhead. */
const LOOKAHEAD = 0.25;
/** How often the scheduler wakes, in milliseconds. */
const TICK_MS = 60;

const BEATS_PER_MINUTE = 84;
const SECONDS_PER_BEAT = 60 / BEATS_PER_MINUTE;

/**
 * Melody in scale degrees of a D minor pentatonic (D F G A C), with `null` for
 * a rest. Sixteen beats per phrase, four phrases per loop.
 */
const SCALE_HZ = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 392.0, 440.0, 523.25];

const PHRASES: readonly (number | null)[][] = [
  [7, null, 5, 6, 7, null, 8, null, 7, 6, 5, null, 3, null, null, null],
  [5, null, 6, 7, 8, null, 9, null, 8, 7, 6, null, 5, null, null, null],
  [3, null, 5, 3, 2, null, 3, null, 5, 6, 7, null, 6, null, 5, null],
  [7, 8, 7, 6, 5, null, 3, null, 2, null, 3, 5, 3, null, null, null],
];

/** Frame-drum pattern: 1 = accented, 0.5 = soft, 0 = silent. */
const DRUM = [1, 0, 0.5, 0, 0.5, 0, 0.5, 0.5, 1, 0, 0.5, 0, 0.5, 0.5, 0.5, 0];

const BEATS_PER_PHRASE = 16;
const TOTAL_BEATS = PHRASES.length * BEATS_PER_PHRASE;

export class MusicPlayer {
  private readonly context: AudioContext;
  private readonly destination: AudioNode;
  private readonly noise: AudioBuffer;

  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBeatTime = 0;
  private beatIndex = 0;
  private drone: { oscillator: OscillatorNode; gain: GainNode } | null = null;

  constructor(context: AudioContext, destination: AudioNode, noise: AudioBuffer) {
    this.context = context;
    this.destination = destination;
    this.noise = noise;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.timer !== null) return;
    this.nextBeatTime = this.context.currentTime + 0.1;
    this.startDrone();
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    // Schedule the opening window immediately so playback starts promptly.
    this.schedule();
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.stopDrone();
    // Beat position is intentionally kept, so pausing and resuming the music
    // does not restart the phrase from the top.
  }

  private startDrone(): void {
    if (this.drone) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = SCALE_HZ[0] ?? 146.83;
    gain.gain.setValueAtTime(0.0001, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.05, this.context.currentTime + 1.2);
    oscillator.connect(gain);
    gain.connect(this.destination);
    oscillator.start();
    this.drone = { oscillator, gain };
  }

  private stopDrone(): void {
    if (!this.drone) return;
    const { oscillator, gain } = this.drone;
    const now = this.context.currentTime;
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      oscillator.stop(now + 0.45);
    } catch {
      // The node may already have been stopped by a context state change.
    }
    this.drone = null;
  }

  private schedule(): void {
    const horizon = this.context.currentTime + LOOKAHEAD;
    let guard = 0;
    while (this.nextBeatTime < horizon && guard < 64) {
      this.scheduleBeat(this.beatIndex, this.nextBeatTime);
      this.nextBeatTime += SECONDS_PER_BEAT / 2; // Melody runs in eighth notes.
      this.beatIndex = (this.beatIndex + 1) % TOTAL_BEATS;
      guard += 1;
    }
  }

  private scheduleBeat(index: number, time: number): void {
    const phrase = PHRASES[Math.floor(index / BEATS_PER_PHRASE) % PHRASES.length];
    const step = index % BEATS_PER_PHRASE;
    const degree = phrase?.[step];

    if (degree !== null && degree !== undefined) {
      const frequency = SCALE_HZ[degree];
      if (frequency !== undefined) {
        playTone(this.context, this.destination, {
          type: 'triangle',
          frequency,
          duration: SECONDS_PER_BEAT * 0.85,
          gain: 0.075,
          attack: 0.02,
          startAt: time,
        });
        // A quiet fifth below thickens the line without muddying it.
        playTone(this.context, this.destination, {
          type: 'sine',
          frequency: frequency / 1.5,
          duration: SECONDS_PER_BEAT * 0.7,
          gain: 0.035,
          attack: 0.03,
          startAt: time,
        });
      }
    }

    const accent = DRUM[step % DRUM.length] ?? 0;
    if (accent > 0) {
      playNoise(this.context, this.destination, {
        buffer: this.noise,
        duration: accent >= 1 ? 0.22 : 0.12,
        gain: accent >= 1 ? 0.09 : 0.045,
        filterType: 'lowpass',
        frequency: accent >= 1 ? 260 : 400,
        sweepTo: 90,
        startAt: time,
      });
    }
  }
}
