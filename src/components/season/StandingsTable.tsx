/**
 * League standings table.
 *
 * The player's own row is marked with text as well as colour, so it is
 * identifiable without relying on the highlight.
 */

import { getTeam } from '../../data/teams.ts';
import type { StandingsRow } from '../../types/season.ts';
import type { TeamId } from '../../types/team.ts';

export interface StandingsTableProps {
  readonly standings: readonly StandingsRow[];
  readonly playerTeamId: TeamId;
  /** Drops the detail columns, for the narrow sidebar. */
  readonly compact?: boolean;
}

export function StandingsTable({ standings, playerTeamId, compact = false }: StandingsTableProps) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="standings" data-testid="standings-table">
        <caption className="visually-hidden">
          League standings, ordered by points then bout difference
        </caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Club</th>
            <th scope="col">P</th>
            {compact ? null : (
              <>
                <th scope="col">W</th>
                <th scope="col">L</th>
                <th scope="col">Bouts</th>
              </>
            )}
            <th scope="col">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, index) => {
            const team = getTeam(row.teamId);
            const isPlayer = row.teamId === playerTeamId;
            return (
              <tr
                key={row.teamId}
                className={isPlayer ? 'standings__row--player' : undefined}
                data-testid={`standings-row-${row.teamId}`}
                data-position={index + 1}
              >
                <td>{index + 1}</td>
                <th scope="row">
                  <span
                    className="standings__swatch"
                    style={{ background: team?.colours.primary }}
                    aria-hidden="true"
                  />
                  {team?.shortName ?? row.teamId}
                  {isPlayer ? <span className="standings__you"> (your club)</span> : null}
                </th>
                <td>{row.played}</td>
                {compact ? null : (
                  <>
                    <td>{row.eventWins}</td>
                    <td>{row.eventLosses}</td>
                    <td>
                      {row.boutsWon}–{row.boutsLost}
                    </td>
                  </>
                )}
                <td>
                  <strong>{row.points}</strong>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
