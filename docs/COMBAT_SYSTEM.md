# Combat system

The Stage 2 combat engine (`src/systems/match/`) is a deterministic, fixed-step
state machine for two fighters. It contains no DOM, React or canvas reference:
rendering, audio, the AI and the bout controller all read from its output rather
than driving it. That is what allows a whole bout — or a whole season — to be
simulated headlessly in a test.

**Presentation contract.** This is sport karate. Health represents a
competitor's condition across a round, not injury. There is no blood, no injury
state, no fatality. A fighter who reaches zero health is unable to continue the
round and the referee stops it.

---

## 1. Where the numbers live

**Every** combat value — damage, stamina cost, wind-up, active frames, recovery,
reach, hitstun, knockback, power gain — is in `src/systems/match/constants.ts`.
No damage number is written anywhere else in the codebase. Screens and renderers
read state; they never contain rules.

## 2. The move table

| Move | Damage | Stamina | Wind-up | Active | Recover | Reach | Power on hit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Light punch | 6 | 7 | 0.07 | 0.07 | 0.13 | 96 | 10 |
| Strong punch | 13 | 18 | 0.18 | 0.09 | 0.30 | 108 | 18 |
| Light kick | 8 | 10 | 0.10 | 0.08 | 0.18 | 124 | 12 |
| Strong kick | 16 | 22 | 0.24 | 0.10 | 0.34 | 142 | 21 |
| Crouch attack | 9 | 12 | 0.10 | 0.08 | 0.20 | 104 | 13 |
| Jump attack | 12 | 12 | 0.08 | 0.16 | 0.12 | 112 | 16 |
| Power attack | 24 | 16 | 0.26 | 0.14 | 0.42 | 150 | — |

Times are seconds, reach is arena units, damage is health points *before* the
attacker's power rating and the defender's toughness are applied.

Balance intent, all asserted by tests:

- Strong attacks are slower, dearer and harder-hitting than light attacks.
- Kicks reach further than punches but start slower.
- No attack is free: every one costs stamina.
- The power attack is the strongest single option and is strictly limited.

## 3. The guard triangle

```
   standing block   beats  high attacks     loses to  crouch attacks
   crouching block  beats  low attacks      loses to  jump attacks
   dodge            beats  everything       costs     stamina and commitment
```

A guard that holds reduces incoming damage to **20%**. A guard that is beaten
(low attack into a standing guard, jump attack into a crouching guard) still
absorbs some of it, at **75%** — being caught out is punished, not fatal.

A dodge grants **0.2s of evasion frames** after a 0.04s wind-up, scaled by the
fighter's agility. Evasion beats everything, including the power attack, but
costs 18 stamina and commits the fighter to a direction.

## 4. Hit detection

An attack resolves once, on the first frame of its active window:

1. The defender must be **in front** of the attacker (sign of the gap matches
   facing) and within `reach + half body width`.
2. The attack's **vertical band** must overlap the defender's occupied height.
   Bands are fractions of fighter height measured from the attacker's feet;
   a crouching defender occupies less of it. The jump attack's band extends
   *below* the attacker (`lowEdge: -0.85`) so it genuinely strikes downward.
3. Outcome, in order: **evasion frames** → **guard** → **clean contact**.

`attackConsumed` guarantees one swing lands at most once.

## 5. Resources

| Resource | Base | Derived from |
| --- | --- | --- |
| Health | 100 | defence and stamina ratings |
| Stamina | 100 | stamina rating |
| Power | 0 → 100 | earned in play only |

**Stamina** regenerates after 0.45s of not spending, at a rate set by the
stamina rating, with a 1.4× bonus while standing still. Holding the guard drains
it continuously; at zero the guard breaks and drops rather than trapping the
fighter.

**Power** is earned by landing attacks, by having attacks blocked, by dodging
successfully, and by *taking* damage (0.55 per point) — so a fighter who is
behind builds a comeback option. A full meter is roughly ten clean light
attacks, deliberately well short of a knockout, so the power attack is reachable
inside a round the fighter has not already won.

The power attack spends the **whole** meter, and its damage is multiplied by the
fighter's own signature technique (`specialAbility.damageScale`, 1.05–1.35).

## 6. Rounds and bouts

- 60-second rounds, best of three, first to two round wins takes the bout.
- A round ends at zero health (knockout) or when the clock expires.
- On a timeout the fighter with more remaining health takes the round.
- If a round expires **exactly** level, a 15-second sudden-death extension is
  played. Only if that also ends level is the round a draw.
- If all three rounds are used and round wins are level, remaining health
  decides; if that is level too, damage dealt decides.

Between rounds, position, health, stamina and power all reset. Round wins and
cumulative statistics carry over.

## 7. Per-fighter handling

`deriveCombatProfile(ratings)` is the only place ratings become mechanics:

| Rating | Effect |
| --- | --- |
| Power (`strength`) | Outgoing damage multiplier |
| Speed | Movement speed, attack speed |
| Defence | Maximum health, incoming damage, guard drain |
| Technique | Attack speed, extra reach |
| Stamina | Maximum stamina, regeneration |
| Agility | Jump height, dodge speed and cost, movement |

Every fighter shares one moveset. They differ in how that moveset *handles*.

## 8. Frame-rate independence

`advance(elapsed, ...)` accumulates real time into fixed 1/120s steps, so
behaviour does not change with refresh rate. A frame longer than 1/30s is
clamped, so a backgrounded tab cannot teleport a fighter through a hitbox. The
consequence is that below ~30fps the simulation runs slower than real time
rather than tunnelling — a deliberate trade for correctness.

## 9. Extending it

`MatchState` holds two `FighterSim` structs by name and the engine has no notion
of which is human. A third fighter, a replay recorder, or a training-mode
overlay would all attach at the same seam: produce a `MatchInput` per corner and
read the event stream.
