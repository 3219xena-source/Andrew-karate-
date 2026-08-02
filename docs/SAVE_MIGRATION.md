# Save migration

One slot, in `localStorage` under `tmac.save.v1`. Only game progress and
preferences are stored — never personal information.

## Versions

| Version | Introduced | Adds |
| --- | --- | --- |
| 1 | Stage 1 | Audio, accessibility, training progress |
| 2 | Stage 2 | Player club, difficulty, season, fighter records, active event, screen-shake and caption settings |
| 3 | Roster re-cast | Retires Cathryn; remaps every reference to Bea Halloran |

`migrateSave` applies migrations in sequence, so a version-1 save reaches
version 3 through both steps in one load. Tested end to end.

## 1 → 2

Everything from version 1 carries over untouched: audio settings, accessibility
settings and the whole training-progress block. New fields are added at their
defaults, and the club the player trained with is **promoted to their season
club**, so a returning player keeps their identity instead of being sent back to
club selection.

## 2 → 3

Cathryn was retired from the Hobart roster. Rather than deleting references —
which would silently drop bouts and change event scores — the migration
**remaps** every occurrence of `cathryn` to `bea-halloran`, including:

- the selected fighter in training progress
- `playerFighterId` and `opponentFighterId` on every recorded bout
- bouts inside an event that is still in progress
- career records, where the retired id is also the object **key**

A completed event therefore keeps its score; the bout is still recorded, just
attributed to the fighter who now holds that slot.

## What is never trusted from disk

The loader is deliberately paranoid. Only **event results** are read back; the
schedule, the standings, the championship opponent and the championship outcome
are all recomputed from them. Specifically:

| Tampering | Outcome |
| --- | --- |
| Edited standings (points, wins) | Recomputed from the bouts |
| `championshipWon: true` with no events played | Rejected; season not complete |
| Bout naming a non-existent fighter | Bout dropped, rest of the event kept |
| `firstTournamentUnlocked` without completing training | Recomputed as false |
| Unknown club id | Season rejected, defaults used |
| Career record for a removed fighter | Dropped |

Each of these has a test.

## Failure handling

| Situation | Behaviour |
| --- | --- |
| No save | Defaults, status `empty` |
| Invalid JSON | Defaults, status `recovered`, player told |
| Not an object | Defaults, status `recovered` |
| Version newer than the build | Recoverable settings kept, rest reset, player told |
| Storage blocked or full | Game runs in memory, visible warning that progress will not persist |
| Individual corrupt field | That field falls back; the rest of the save survives |

## Mid-bout policy

A bout in progress is **not** saved. Completed bouts in the event are. A refresh
mid-bout restarts that bout from round one and keeps every bout already won.
