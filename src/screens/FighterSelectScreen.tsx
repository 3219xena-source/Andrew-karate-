/**
 * Fighter-selection screen.
 *
 * The roster grid on the left drives a live profile panel on the right.
 * Highlighting is shared between mouse hover, keyboard focus and explicit
 * clicks, so keyboard users get exactly the same preview behaviour as pointer
 * users. Confirming a fighter saves the choice and enters the dojo.
 */

import { useEffect } from 'react';
import { Button } from '../components/ui/Button.tsx';
import { Portrait } from '../components/ui/Portrait.tsx';
import { ScreenFrame } from '../components/ui/ScreenFrame.tsx';
import { StatBar } from '../components/ui/StatBar.tsx';
import { getRoster, getStrongestStats } from '../data/fighters.ts';
import { getTeam } from '../data/teams.ts';
import { audioManager } from '../systems/audio/audioManager.ts';
import { selectPreviewFighter, useGameStore } from '../state/gameStore.ts';
import { STAT_LABELS, STAT_KEYS, type Fighter } from '../types/fighter.ts';

/**
 * Idle-stance placeholder. A simple breathing silhouette in the fighter's own
 * gi colours, standing in for the eventual animated character model.
 */
function IdleStance({ fighter }: { readonly fighter: Fighter }) {
  return (
    <div className="stance" role="img" aria-label={`${fighter.name} idle stance (animated placeholder)`}>
      <svg className="stance__figure" width="52" height="76" viewBox="0 0 52 76" aria-hidden="true">
        <circle cx="26" cy="12" r="9" fill={fighter.animation.giColour} />
        <path
          d="M26 21 L38 34 L34 52 L18 52 L14 34 Z"
          fill={fighter.animation.giColour}
          stroke={fighter.animation.accentColour}
          strokeWidth="1.5"
        />
        <rect x="15" y="46" width="22" height="4" rx="2" fill={fighter.animation.beltColour} />
        <path d="M18 52 L16 74" stroke={fighter.animation.giColour} strokeWidth="6" strokeLinecap="round" />
        <path d="M34 52 L36 74" stroke={fighter.animation.giColour} strokeWidth="6" strokeLinecap="round" />
        <path d="M14 34 L4 44" stroke={fighter.animation.giColour} strokeWidth="5" strokeLinecap="round" />
        <path d="M38 34 L48 44" stroke={fighter.animation.giColour} strokeWidth="5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function FighterSelectScreen() {
  const selectedTeamId = useGameStore((state) => state.progress.selectedTeamId);
  const selectedFighterId = useGameStore((state) => state.progress.selectedFighterId);
  const previewFighter = useGameStore((state) => state.previewFighter);
  const selectFighter = useGameStore((state) => state.selectFighter);
  const goToScreen = useGameStore((state) => state.goToScreen);
  const highlighted = useGameStore(selectPreviewFighter);

  const team = getTeam(selectedTeamId);
  const roster = getRoster(selectedTeamId);

  // Guarantee that something is always highlighted, even if the store arrived
  // here with a preview that belongs to another club.
  useEffect(() => {
    if (highlighted && highlighted.teamId === selectedTeamId) return;
    const first = roster.find((fighter) => fighter.unlocked) ?? roster[0];
    if (first) previewFighter(first.id);
  }, [highlighted, previewFighter, roster, selectedTeamId]);

  if (!team || roster.length === 0) {
    return (
      <ScreenFrame eyebrow="Roster" title="Fighter selection">
        <div className="state-block" role="alert">
          <h2 className="state-block__title">No roster is available</h2>
          <p className="state-block__body">
            {team
              ? `${team.name} has no fighter records to display.`
              : 'No club is selected, so there is no roster to show.'}
          </p>
          <Button variant="primary" onClick={() => goToScreen('map')}>
            Back to the map
          </Button>
        </div>
      </ScreenFrame>
    );
  }

  const profile = highlighted ?? roster[0];
  const strongest = profile ? getStrongestStats(profile) : [];
  const strongestKeys = new Set(strongest.map(([key]) => key));

  return (
    <ScreenFrame
      eyebrow={`${team.location} · ${team.name}`}
      title="Choose your fighter"
      footer={
        <>
          <Button
            variant="ghost"
            sound="menu-back"
            onClick={() => goToScreen('team')}
            data-testid="fighter-back"
          >
            Back
          </Button>
          <Button
            variant="primary"
            disabled={!profile?.unlocked}
            onClick={() => profile && selectFighter(profile.id)}
            data-testid="select-fighter"
          >
            {profile ? `Select ${profile.name}` : 'Select fighter'}
          </Button>
        </>
      }
    >
      <div className="roster-layout">
        <ul className="roster-grid" data-testid="fighter-grid">
          {roster.map((fighter) => {
            const isHighlighted = profile?.id === fighter.id;
            return (
              <li key={fighter.id}>
                <button
                  type="button"
                  className={`card${isHighlighted ? ' card--selected' : ''}`}
                  aria-pressed={isHighlighted}
                  disabled={!fighter.unlocked}
                  data-testid={`fighter-card-${fighter.id}`}
                  onMouseEnter={() => {
                    if (!fighter.unlocked || isHighlighted) return;
                    audioManager.play('menu-move');
                    previewFighter(fighter.id);
                  }}
                  onFocus={() => fighter.unlocked && previewFighter(fighter.id)}
                  onClick={() => previewFighter(fighter.id)}
                >
                  <div className="fighter-card__head">
                    <div className="fighter-card__portrait">
                      <Portrait fighter={fighter} compact />
                    </div>
                    <div>
                      <span className="fighter-card__name">{fighter.name}</span>
                      <span className="fighter-card__role">{fighter.role}</span>
                    </div>
                  </div>
                  <div className="row row--wrap">
                    {fighter.id === selectedFighterId ? (
                      <span className="badge badge--featured">Selected</span>
                    ) : null}
                    {fighter.ageClassification === 'junior' ? (
                      <span className="badge badge--junior">Junior</span>
                    ) : null}
                    {!fighter.unlocked ? <span className="badge badge--placeholder">Locked</span> : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {profile ? (
          <section className="panel" aria-live="polite" data-testid="fighter-profile">
            <div className="fighter-profile__head">
              <div className="fighter-profile__portrait">
                <Portrait fighter={profile} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p className="panel__eyebrow">{profile.role}</p>
                <h2 className="panel__title">{profile.name}</h2>
                <p className="subtle">{profile.fightingStyle}</p>
                {profile.relationship ? <p className="subtle">{profile.relationship}</p> : null}
                <div className="row row--wrap" style={{ marginTop: 'var(--space-2)' }}>
                  <span className="badge">{ageLabel(profile.ageClassification)}</span>
                  {profile.isPlaceholder ? (
                    <span className="badge badge--placeholder">Placeholder record</span>
                  ) : null}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-4)' }}>
              <IdleStance fighter={profile} />
            </div>

            <p className="text-small muted" style={{ marginTop: 'var(--space-4)' }}>
              {profile.biography}
            </p>

            <div className="fighter-profile__stats">
              {STAT_KEYS.map((key) => (
                <StatBar
                  key={key}
                  label={STAT_LABELS[key]}
                  value={profile.stats[key]}
                  highlight={strongestKeys.has(key)}
                />
              ))}
            </div>

            <p className="subtle" data-testid="strongest-abilities">
              Strongest attributes:{' '}
              {strongest.map(([key, value]) => `${STAT_LABELS[key]} ${value}`).join(', ')}
            </p>

            <div className="ability" style={{ marginTop: 'var(--space-4)' }}>
              <p className="ability__name">Special ability · {profile.specialAbility.name}</p>
              <p className="text-small muted">{profile.specialAbility.description}</p>
              <p className="subtle" style={{ marginTop: 'var(--space-2)' }}>
                Stage 1 note: special abilities are descriptive. Handling in the dojo is driven by the
                ratings above.
              </p>
            </div>

            {!profile.unlocked ? (
              <p className="subtle" style={{ marginTop: 'var(--space-4)' }}>
                This fighter is a Stage 2 roster placeholder and cannot be selected in this build.
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
    </ScreenFrame>
  );
}

function ageLabel(classification: Fighter['ageClassification']): string {
  switch (classification) {
    case 'junior':
      return 'Junior class';
    case 'senior':
      return 'Senior class';
    default:
      return 'Adult class';
  }
}
