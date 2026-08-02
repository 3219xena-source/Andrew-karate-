/**
 * A labelled 0..100 statistic bar.
 *
 * The numeric value is always rendered as text beside the bar, so the rating is
 * never communicated by bar length or colour alone.
 */

export interface StatBarProps {
  readonly label: string;
  readonly value: number;
  /** Renders in the gold treatment, used for a fighter's strongest attributes. */
  readonly highlight?: boolean;
}

export function StatBar({ label, value, highlight = false }: StatBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="stat">
      <span className="stat__label" id={`stat-${label.toLowerCase()}`}>
        {label}
        {highlight ? <span className="visually-hidden"> (strongest attribute)</span> : null}
      </span>
      <div
        className="stat__track"
        role="meter"
        aria-labelledby={`stat-${label.toLowerCase()}`}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`stat__fill${highlight ? ' stat__fill--highlight' : ''}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="stat__value">{clamped}</span>
    </div>
  );
}
