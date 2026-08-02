/**
 * A live meter for stamina and tutorial progress.
 *
 * Unlike `StatBar` this is intended to change every frame, so the fill uses a
 * linear transition rather than an eased one. The percentage is always written
 * out, keeping the value readable without relying on colour.
 */

export interface MeterProps {
  readonly label: string;
  /** Current value, in the same units as `max`. */
  readonly value: number;
  readonly max: number;
  /** Renders in the warning treatment below this ratio of `max`. */
  readonly lowThreshold?: number;
  /** Text shown on the right of the label row. Defaults to a percentage. */
  readonly readout?: string;
}

export function Meter({ label, value, max, lowThreshold = 0.3, readout }: MeterProps) {
  const safeMax = max > 0 ? max : 1;
  const ratio = Math.max(0, Math.min(1, value / safeMax));
  const low = ratio <= lowThreshold;
  const text = readout ?? `${Math.round(ratio * 100)}%`;

  return (
    <div className="meter">
      <div className="meter__head">
        <span id={`meter-${label.replace(/\s+/g, '-').toLowerCase()}`}>{label}</span>
        <span>{text}</span>
      </div>
      <div
        className="meter__track"
        role="meter"
        aria-labelledby={`meter-${label.replace(/\s+/g, '-').toLowerCase()}`}
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={text}
      >
        <div
          className={`meter__fill${low ? ' meter__fill--low' : ''}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
