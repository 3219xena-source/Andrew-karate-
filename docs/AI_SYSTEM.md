# Opponent AI

`src/systems/ai/opponentAI.ts`

The AI is a pure function of the visible match state that returns a
`MatchInput` — exactly the structure the keyboard produces. The engine cannot
tell the difference between the two.

## The three guarantees

**1. It cannot cheat.** It has no way to change health, stamina, power or
position. It can only press the buttons a player can press, and every cost,
cooldown, hitstun rule and arena boundary applies to it identically. Difficulty
never touches damage or health. Tests assert that its stamina, power and health
stay inside legal bounds across long fights, and that the player takes no damage
while out of every attack's reach.

**2. It cannot read the future.** It reacts to what has already happened. Every
*change* in the opponent's action starts a difficulty-scaled reaction delay
before the AI may respond to it, and a decision interval prevents frame-perfect
play. Buttons are pressed as genuine edges — held for one frame, then released —
so it cannot hold an attack button any more than a player can.

**3. It is deterministic.** Decisions come from a seeded linear-congruential
source, not `Math.random()`. The same seed produces the same fight, which is
what makes AI-versus-AI simulation reproducible and the tests stable.

## Decision flow

Each decision tick, in priority order:

1. **Stunned or beaten** → release everything. Outranks every other rule.
2. **Threatened** (opponent winding up or swinging within reach, reaction delay
   elapsed) → dodge, or raise the guard, crouch-blocking a low attack.
3. **Stamina spent** (below the difficulty's floor) → retreat and recover.
4. **Power full and opponent close** → spend it, weighted by how decisive the
   moment is.
5. **In range** → attack, or hold the guard.
6. **Out of range** → close to, or hold, the personality's preferred distance.

Reported through `getIntent()` as one of: `idle`, `approach`, `retreat`,
`attack`, `combo`, `defend`, `evade`, `recover`, `finisher`, `stunned`,
`defeated`.

## Difficulty bands

| | Reaction | Aggression | Guard | Evasion | Combo | Decision interval |
| --- | --- | --- | --- | --- | --- | --- |
| Beginner | 0.42s | 0.34 | 0.30 | 0.08 | 0.12 | 0.30s |
| Standard | 0.24s | 0.55 | 0.58 | 0.24 | 0.35 | 0.18s |
| Advanced | 0.14s | 0.72 | 0.78 | 0.42 | 0.55 | 0.12s |

On **Standard**, the club's own difficulty band shifts the AI one step:
approachable clubs play at Beginner, formidable clubs at Advanced. An explicit
player choice of Beginner or Advanced always wins.

Tests assert that Advanced throws more attacks than Beginner across five seeds,
and that a beginner opponent can be damaged by a player who simply walks forward
and attacks.

## Fighter personalities

Layered on top of the difficulty band, from each fighter's `aiProfile`:

| Profile | Aggression | Guard | Evasion | Preferred range | Kick bias |
| --- | --- | --- | --- | --- | --- |
| `aggressive` | +0.20 | −0.15 | −0.05 | 96 | 0.35 |
| `defensive` | −0.18 | +0.22 | +0.02 | 138 | 0.40 |
| `balanced` | 0 | 0 | 0 | 116 | 0.45 |
| `evasive` | −0.05 | −0.10 | +0.28 | 130 | 0.50 |
| `technical` | +0.02 | +0.12 | +0.12 | 122 | 0.55 |
| `powerhouse` | +0.12 | +0.14 | −0.12 | 100 | 0.25 |

Technique choice also reads the situation: a standing guard invites a low
attack, an airborne opponent invites a strong punch, and the AI will not press a
button it cannot afford.

## Known limitations

- No learning or adaptation within or across bouts.
- No awareness of the club score or of which bout it is.
- Combos are a probability of extending, not an authored combo table.
- It has never been tuned against real players, only against test harnesses.
