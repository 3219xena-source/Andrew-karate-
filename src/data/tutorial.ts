/**
 * The Stage 1 training-dojo curriculum.
 *
 * Objectives run in order. Each one owns its instruction text, its completion
 * condition and its coach dialogue, so the curriculum can be re-sequenced or
 * extended without touching the tutorial engine or the dojo screen.
 *
 * Coach dialogue is written for Mr Graham, the club's senior coach. Junior
 * students train here under supervision: instructions stay respectful and
 * technical, and nothing in the session depicts injury.
 */

import { MARK_X, STAMINA_LOW_RATIO, STAMINA_RECOVERED_RATIO } from '../systems/combat/constants.ts';
import type { CombatEvent } from '../systems/combat/types.ts';
import type { ObjectiveContext, ObjectiveDefinition } from '../systems/tutorial/types.ts';

/**
 * Counts matching events from this update and adds them to a running total held
 * in the objective's scratch memory. Safe to call once per update only, which
 * is the contract for `measure`.
 */
function accumulate(
  context: ObjectiveContext,
  key: string,
  predicate: (event: CombatEvent) => boolean,
): number {
  const gained = context.events.filter(predicate).length;
  const total = (context.memory[key] ?? 0) + gained;
  context.memory[key] = total;
  return total;
}

/** Distance the player must cover in one direction for it to count as movement. */
const WALK_THRESHOLD = 70;

export const TUTORIAL_OBJECTIVES: readonly ObjectiveDefinition[] = [
  {
    id: 'reach-mark',
    title: 'Take your place',
    instruction: 'Walk onto the marked training area with A / D or the arrow keys.',
    coachLine:
      'Welcome to the dojo. Start by walking onto the mark in the centre of the floor — every session begins from the same place.',
    successLine: 'Good. Feet settled, back straight. That is where we start from.',
    target: 1,
    measure: (context) => (context.engine.isOnMark() ? 1 : 0),
  },
  {
    id: 'footwork',
    title: 'Footwork',
    instruction: 'Move left, then move right. Keep your balance as you change direction.',
    coachLine:
      'Now the footwork. Travel left, then travel right. I want to see you change direction without losing your stance.',
    successLine: 'That is it — you are moving from the floor, not from the shoulders.',
    target: 2,
    progressNoun: 'directions',
    onActivate: (context) => {
      const state = context.engine.getState();
      context.memory.baseLeft = state.distanceLeft;
      context.memory.baseRight = state.distanceRight;
    },
    measure: (context) => {
      const state = context.engine.getState();
      const left = state.distanceLeft - (context.memory.baseLeft ?? 0);
      const right = state.distanceRight - (context.memory.baseRight ?? 0);
      return (left >= WALK_THRESHOLD ? 1 : 0) + (right >= WALK_THRESHOLD ? 1 : 0);
    },
  },
  {
    id: 'jump',
    title: 'Lift',
    instruction: 'Press W, the up arrow or Space to jump.',
    coachLine:
      'Show me a jump. Land softly, knees giving — we protect the joints in this club.',
    successLine: 'Light on landing. Well done.',
    target: 1,
    measure: (context) => accumulate(context, 'jumps', (event) => event.type === 'jump'),
  },
  {
    id: 'light-attacks',
    title: 'Light technique',
    instruction: 'Step to the practice pad and land three light attacks with J.',
    coachLine:
      'Move up to the pad and give me three light techniques. Speed and accuracy, not power — the pad does the absorbing.',
    successLine: 'Three clean techniques. Your distance is good.',
    target: 3,
    progressNoun: 'landed',
    measure: (context) =>
      accumulate(context, 'lightHits', (event) => event.type === 'hit' && event.power === 'light'),
  },
  {
    id: 'strong-attack',
    title: 'Strong technique',
    instruction: 'Land one strong attack with K. It costs more stamina, so commit to it.',
    coachLine:
      'Now one strong technique with K. It is slower and it costs you stamina, so choose your moment.',
    successLine: 'Committed and controlled. That is the difference between strong and reckless.',
    target: 1,
    progressNoun: 'landed',
    measure: (context) =>
      accumulate(context, 'strongHits', (event) => event.type === 'hit' && event.power === 'strong'),
  },
  {
    id: 'block',
    title: 'Guard',
    instruction: 'Hold L to block. Absorb two practice strikes from the pad.',
    coachLine:
      'The pad will work now. Hold L to bring your guard up and absorb two practice strikes. Watch for the wind-up.',
    successLine: 'Guard held. Notice the stamina it costs you — a guard is not free.',
    target: 2,
    progressNoun: 'blocked',
    padStrikes: true,
    measure: (context) => accumulate(context, 'blocks', (event) => event.type === 'block'),
  },
  {
    id: 'dodge',
    title: 'Evasion',
    instruction: 'Press Shift to dodge. Time one dodge to evade an incoming practice strike.',
    coachLine:
      'This time do not take it on the guard. Press Shift and move off the line as the strike comes.',
    successLine: 'Beautiful timing. Nothing to absorb if it never reaches you.',
    target: 1,
    progressNoun: 'evaded',
    padStrikes: true,
    measure: (context) => accumulate(context, 'evades', (event) => event.type === 'evade'),
  },
  {
    id: 'combination',
    title: 'Combination',
    instruction: 'Land a combination on the pad: light, light, then strong (J, J, K).',
    coachLine:
      'Link them together now — light, light, strong. Each technique should set up the next without a pause.',
    successLine: 'That is a combination. Andrew has built his whole game on that link.',
    target: 1,
    progressNoun: 'combination',
    measure: (context) => accumulate(context, 'combos', (event) => event.type === 'combo'),
  },
  {
    id: 'stamina',
    title: 'Recovery',
    instruction: `Work until your stamina drops below ${Math.round(STAMINA_LOW_RATIO * 100)}%, then rest until it returns above ${Math.round(STAMINA_RECOVERED_RATIO * 100)}%.`,
    coachLine:
      'Work hard enough to run your stamina down, then stand still and let it come back. Recovery is a skill you train like any other.',
    successLine: 'Recovered and breathing steadily. That is what wins a long tournament day.',
    target: 1,
    measure: (context) =>
      accumulate(context, 'recovered', (event) => event.type === 'stamina-recovered'),
  },
  {
    id: 'bow',
    title: 'Respect',
    instruction: 'Stand still and press B to bow. Every session opens and closes with respect.',
    coachLine:
      'Last thing. Stand still, and bow. We begin and end with respect — for the dojo, and for whoever stands opposite you.',
    successLine: 'Session complete. You have earned your place on the Hobart mat.',
    target: 1,
    measure: (context) => accumulate(context, 'bows', (event) => event.type === 'bow'),
  },
];

/** Convenience export for the dojo renderer's floor marking. */
export const TUTORIAL_MARK_X = MARK_X;
