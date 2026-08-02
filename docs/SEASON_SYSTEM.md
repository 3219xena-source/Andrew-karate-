# Season system

A season is six events for one player club: five league ties against each rival,
then the Tasmania Championship Final.

## Club events

Every event is **six sequential one-versus-one bouts**, paired slot for slot.

```
Player slot 1  vs  Opponent slot 1
Player slot 2  vs  Opponent slot 2
...
Player slot 6  vs  Opponent slot 6
```

All six are contested, even after one club has mathematically won the tie. That
is how club competition works, it gives every fighter their bout, and it is what
makes 5–1 and 6–0 score lines reachable.

**Bout-order safety.** Every club fills the same six slots with the same
competition class and weight division:

| Slot | Class | Division |
| --- | --- | --- |
| 1 | Adult | Middleweight |
| 2 | Junior | Junior |
| 3 | Junior | Junior |
| 4 | Senior | Middleweight |
| 5 | Adult | Lightweight |
| 6 | Senior | Lightweight |

Because pairing is by slot, a junior can only ever meet a junior. This is not
left to the data being right: `validatePairing` re-checks every bout at runtime,
and a test asserts the rule across **all 30 possible club fixtures** and across
every junior-versus-open combination in the game.

## Tie-break

Six bouts can finish 3–3. When they do, each club nominates its
**highest-rated open-division competitor** for a deciding seventh bout. Juniors
are never nominated, so the decider is always a legal pairing. A tie-break win
counts as a normal event win.

No 3–3 event is ever left without a result.

## Points and the table

- Event win: **3 points**. Event loss: **0**.
- Ranked by points, then bout difference, then bouts won, then club name.

**Your club's results are always real bouts you fought.** The four rival clubs
not facing you in a given round also play each other; those fixtures are
resolved by a deterministic strength model derived from each club's authored
ratings, rather than being simulated bout by bout. The standings screen states
this in the interface, not just here.

## Schedule

Rounds 1–5 pair the player against each rival once. Odd rounds are at the
player's home venue, even rounds away, so a season visits venues across the
island rather than repeating one.

## Championship

The final is contested at the championship venue in Hobart.

**The standings decide who the player faces**: the highest-placed rival after
round five. The player's club is **seeded into the final as the season's host**,
so the season can always be completed. The qualification screen reports honestly
which of the two applies — whether the club earned a genuine top-two finish, or
reached the final on the host seed — and shows the league position either way.

The championship sits outside the league table: it does not add points or change
any club's played count.

## Persistence

Only **event results** are written to disk. On load, the schedule, the standings,
the championship opponent and the championship outcome are all **recomputed**
from those results. A hand-edited table, an invented championship flag or a
tampered score line therefore has no effect — tests assert each of those.

An event in progress saves its **completed bouts**, so a refresh mid-event does
not cost the player bouts they already won. The bout that was in progress is not
saved and restarts from round one.
