/**
 * Interactive Tasmania selection map.
 *
 * The island outline is an ORIGINAL stylised vector drawn for this project in a
 * 0–100 coordinate space. It is a recognisable, deliberately simplified
 * illustration — not survey data, and not derived from any commercial map tile,
 * satellite image or licensed dataset. See `docs/ASSET_REGISTER.md`.
 *
 * Accessibility: the artwork is decorative and hidden from assistive
 * technology. The six location markers are real HTML buttons positioned over
 * the artwork by percentage, so they are reachable with Tab, activated with
 * Enter or Space, and carry proper pressed state — none of which is reliable
 * with clickable SVG shapes.
 */

import { useId } from 'react';
import { audioManager } from '../../systems/audio/audioManager.ts';
import type { Team, TeamId } from '../../types/team.ts';

/**
 * Stylised coastline. Drawn clockwise from the north-west corner: north coast,
 * east coast with its bays, the southern peninsulas, then the west coast.
 */
const COASTLINE =
  // North coast, west to east: Cape Grim across to the north-east corner.
  'M15 22 L21 16 L30 17.5 L40 16 L50 17 L60 16.5 L69 18 L76 23 ' +
  // East coast: two shallow bays and the Freycinet spur.
  'L78 30 L73.5 34 L78.5 39 L74 46 L76.5 53 L71 59 L72.5 67 L67 72 ' +
  // South-east: the Tasman peninsula lobe.
  'L69 79 L63.5 80.5 L61.5 74.5 L55 82 ' +
  // South coast, tapering to the southern point and the channel country.
  'L48 86 L42 82 L37 86 L31 79 ' +
  // West coast, running back north to the starting point.
  'L24 71 L17 58 L19 45 L13.5 34 L16 27 Z';

/** A second, inset path used as a soft interior highlight (the highlands). */
const INTERIOR =
  'M25 29 L37 25.5 L49 25 L60 27 L68 32 L69 44 L64 56 L56 68 L47 76 L37 71 L28 61 L25 46 Z';

export interface TasmaniaMapProps {
  readonly teams: readonly Team[];
  readonly selectedTeamId: TeamId | null;
  readonly focusedTeamId: TeamId | null;
  readonly onFocusTeam: (teamId: TeamId) => void;
  /** Called on click/Enter. Opens the team panel; it does not confirm the club. */
  readonly onActivateTeam: (teamId: TeamId) => void;
}

export function TasmaniaMap({
  teams,
  selectedTeamId,
  focusedTeamId,
  onFocusTeam,
  onActivateTeam,
}: TasmaniaMapProps) {
  const gradientId = useId();

  return (
    <div className="tas-map">
      <svg className="tas-map__art" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${gradientId}-land`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1f3a2c" />
            <stop offset="55%" stopColor="#22405a" />
            <stop offset="100%" stopColor="#14243a" />
          </linearGradient>
          <radialGradient id={`${gradientId}-sea`} cx="50%" cy="45%" r="70%">
            <stop offset="0%" stopColor="#0d1a2b" />
            <stop offset="100%" stopColor="#070c14" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="100" height="100" fill={`url(#${gradientId}-sea)`} />

        {/* Bathymetry-style contour rings: decorative, evokes an aerial chart. */}
        <path d={COASTLINE} className="tas-map__halo" transform="translate(50 50) scale(1.06) translate(-50 -50)" />
        <path d={COASTLINE} className="tas-map__halo" transform="translate(50 50) scale(1.12) translate(-50 -50)" />

        <path d={COASTLINE} fill={`url(#${gradientId}-land)`} className="tas-map__land" />
        <path d={INTERIOR} className="tas-map__interior" />
      </svg>

      <ul className="tas-map__markers">
        {teams.map((team) => {
          const selected = team.id === selectedTeamId;
          const focused = team.id === focusedTeamId;
          return (
            <li
              key={team.id}
              className="tas-map__marker-slot"
              style={{ left: `${team.mapPosition.x}%`, top: `${team.mapPosition.y}%` }}
            >
              <button
                type="button"
                className={[
                  'tas-marker',
                  selected ? 'tas-marker--selected' : '',
                  focused ? 'tas-marker--focused' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={selected}
                data-testid={`map-marker-${team.id}`}
                onFocus={() => onFocusTeam(team.id)}
                onMouseEnter={() => {
                  if (focusedTeamId !== team.id) audioManager.play('menu-move');
                  onFocusTeam(team.id);
                }}
                onClick={() => {
                  audioManager.play('menu-select');
                  onActivateTeam(team.id);
                }}
              >
                <span
                  className="tas-marker__dot"
                  style={{ background: team.emblem.primary }}
                  aria-hidden="true"
                />
                <span className={`tas-marker__label tas-marker__label--${team.labelAnchor}`}>
                  {team.location}
                </span>
                <span className="visually-hidden">
                  {`${team.location}. ${team.name}. Coach ${team.coach}. Speciality: ${team.speciality}.`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
