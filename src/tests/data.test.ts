/**
 * Team- and fighter-data loading.
 *
 * These tests are the contract for the content layer: the six clubs exist, each
 * has a six-fighter roster, and every fighter record is structurally valid.
 * They also guard the safety rules that the content must not break.
 */

import { describe, expect, it } from 'vitest';
import {
  FIGHTERS,
  getFighter,
  getRoster,
  getStrongestStats,
  isSelectableFighterId,
} from '../data/fighters.ts';
import { FEATURED_TEAM_ID, TEAMS, getTeam, isKnownTeamId } from '../data/teams.ts';
import { STAT_KEYS } from '../types/fighter.ts';
import { TEAM_IDS } from '../types/team.ts';

describe('team data', () => {
  it('provides exactly the six Tasmanian clubs', () => {
    expect(TEAMS).toHaveLength(6);
    expect(TEAMS.map((team) => team.id)).toEqual([...TEAM_IDS]);
    expect(TEAMS.map((team) => team.location)).toEqual([
      'Hobart',
      'Launceston',
      'Devonport',
      'Burnie',
      'Smithton',
      'Rosebery',
    ]);
  });

  it('gives every club the fields the map and team panel render', () => {
    for (const team of TEAMS) {
      expect(team.name.length).toBeGreaterThan(0);
      expect(team.style.length).toBeGreaterThan(0);
      expect(team.strength.length).toBeGreaterThan(0);
      expect(team.personality.length).toBeGreaterThan(0);
      expect(team.speciality.length).toBeGreaterThan(0);
      expect(team.description.length).toBeGreaterThan(20);
      expect(team.emblem.glyph.length).toBeGreaterThan(0);
    }
  });

  it('places every marker inside the map viewport', () => {
    for (const team of TEAMS) {
      expect(team.mapPosition.x).toBeGreaterThan(0);
      expect(team.mapPosition.x).toBeLessThan(100);
      expect(team.mapPosition.y).toBeGreaterThan(0);
      expect(team.mapPosition.y).toBeLessThan(100);
    }
  });

  it('looks up clubs by id and rejects unknown ids', () => {
    expect(getTeam('hobart')?.location).toBe('Hobart');
    expect(getTeam(null)).toBeUndefined();
    expect(isKnownTeamId('hobart')).toBe(true);
    expect(isKnownTeamId('adelaide')).toBe(false);
    expect(isKnownTeamId(42)).toBe(false);
  });

  it('marks exactly one club as the featured, fully authored club', () => {
    const featured = TEAMS.filter((team) => team.status === 'featured');
    expect(featured).toHaveLength(1);
    expect(featured[0]?.id).toBe(FEATURED_TEAM_ID);
  });
});

describe('fighter data', () => {
  it('gives every club a six-fighter roster', () => {
    for (const team of TEAMS) {
      expect(getRoster(team.id)).toHaveLength(6);
    }
    expect(FIGHTERS).toHaveLength(36);
  });

  it('lists the six authored main-team fighters', () => {
    const roster = getRoster(FEATURED_TEAM_ID);
    expect(roster.map((fighter) => fighter.name)).toEqual([
      'Andrew Gillian',
      'Ales',
      'Cathryn',
      'Mr Graham',
      'Janet',
      'Mrs Graham',
    ]);
    expect(roster.every((fighter) => fighter.unlocked)).toBe(true);
    expect(roster.every((fighter) => !fighter.isPlaceholder)).toBe(true);
  });

  it('keeps every rating inside the authored 1..100 range', () => {
    for (const fighter of FIGHTERS) {
      for (const key of STAT_KEYS) {
        const value = fighter.stats[key];
        expect(value, `${fighter.id}.${key}`).toBeGreaterThanOrEqual(1);
        expect(value, `${fighter.id}.${key}`).toBeLessThanOrEqual(100);
      }
    }
  });

  it('gives every fighter the configuration the UI and engine require', () => {
    for (const fighter of FIGHTERS) {
      expect(fighter.id).toMatch(/^[a-z0-9-]+$/);
      expect(fighter.biography.length).toBeGreaterThan(20);
      expect(fighter.fightingStyle.length).toBeGreaterThan(0);
      expect(fighter.specialAbility.name.length).toBeGreaterThan(0);
      expect(fighter.animation.set.length).toBeGreaterThan(0);
      expect(fighter.voice.bank).toContain('audio/voice/');
      expect(getTeam(fighter.teamId)).toBeDefined();
    }
  });

  it('ships no recorded voice lines, matching the documented Stage 1 scope', () => {
    expect(FIGHTERS.every((fighter) => fighter.voice.enabled === false)).toBe(true);
  });

  it('flags every non-featured roster entry as an unselectable placeholder', () => {
    const others = FIGHTERS.filter((fighter) => fighter.teamId !== FEATURED_TEAM_ID);
    expect(others).toHaveLength(30);
    expect(others.every((fighter) => fighter.isPlaceholder)).toBe(true);
    expect(others.every((fighter) => !fighter.unlocked)).toBe(true);
    expect(others.every((fighter) => isSelectableFighterId(fighter.id) === false)).toBe(true);
  });

  it('gives every fighter a unique id', () => {
    const ids = new Set(FIGHTERS.map((fighter) => fighter.id));
    expect(ids.size).toBe(FIGHTERS.length);
  });

  it('resolves fighters by id and rejects unknown ids', () => {
    expect(getFighter('andrew-gillian')?.name).toBe('Andrew Gillian');
    expect(getFighter('nobody')).toBeUndefined();
    expect(getFighter(null)).toBeUndefined();
    expect(isSelectableFighterId('andrew-gillian')).toBe(true);
    expect(isSelectableFighterId('nobody')).toBe(false);
  });

  it('reports a fighter’s strongest attributes, strongest first', () => {
    const janet = getFighter('janet-gillian');
    expect(janet).toBeDefined();
    const strongest = getStrongestStats(janet!);
    expect(strongest).toHaveLength(2);
    expect(strongest[0]?.[0]).toBe('technique');
    expect(strongest[0]?.[1]).toBeGreaterThanOrEqual(strongest[1]?.[1] ?? 0);
  });

  it('classifies the two junior students for supervised training', () => {
    const juniors = getRoster(FEATURED_TEAM_ID).filter(
      (fighter) => fighter.ageClassification === 'junior',
    );
    expect(juniors.map((fighter) => fighter.name)).toEqual(['Ales', 'Cathryn']);
  });

  it('returns an empty roster rather than throwing for an unknown club', () => {
    expect(getRoster(null)).toEqual([]);
    // Deliberately invalid id, as a corrupt save could supply one.
    expect(getRoster('atlantis' as never)).toEqual([]);
  });
});
