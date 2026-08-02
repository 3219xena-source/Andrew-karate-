# Test report — Stage 2

All figures below are from the final verification run on branch
`claude/stage-2-complete-season`. Every command is reproducible.

## Commands and results

| Command | Result |
| --- | --- |
| `npm run typecheck` | **Clean** — TypeScript strict, `noUncheckedIndexedAccess`, no errors |
| `npm run test` | **241 passed / 241**, 10 files |
| `npm run test:e2e` | **14 passed / 14**, 6.5 minutes |
| `npm run build` | **Clean** — 387.10 kB JS (118.39 kB gzip), 29.18 kB CSS (5.64 kB gzip) |
| `npm run preview` | Serves at `http://127.0.0.1:4173` — verified |
| `npm run verify:standalone` | **Passed** — single-file bundle boots, plays, persists |
| `npm audit` | **0 vulnerabilities** (and 0 with `--omit=dev`) |

Playwright runs against a **production build**, not the dev server, so the
bundle that ships is the bundle that is tested.

## Unit and component tests — 241

| Suite | Tests | Covers |
| --- | --- | --- |
| `matchEngine.test.ts` | 40 | Movement, jump, crouch, facing, collision, all seven attacks, block, dodge, stamina, power, rounds, timeout, sudden death, best-of-three, frame-rate independence |
| `season.test.ts` | 32 | Matchmaking safety, six-bout events, 4–2 / 5–1 / 6–0, 3–3 tie-break, standings, championship, venues |
| `combatEngine.test.ts` | 31 | Stage 1 training engine (preserved) |
| `navigation.test.tsx` | 30 | Rendered screen flow, wiring, error states, accessibility |
| `gameStore.test.ts` | 26 | Navigation, selection, audio persistence, completion, reset |
| `saveMigration.test.ts` | 21 | v1→v2→v3 migration, retired fighter remap, season persistence, tamper resistance |
| `data.test.ts` | 17 | Six clubs, 36 fighters, ratings, slot template, provenance |
| `saveManager.test.ts` | 16 | Corrupt, missing, hostile and future-version saves |
| `opponentAI.test.ts` | 16 | AI legality, behaviour, difficulty, determinism |
| `tutorialEngine.test.ts` | 12 | Stage 1 curriculum (preserved) |

### Safety coverage worth naming

- **Junior protection** is asserted exhaustively: every junior against every
  adult and senior in the game is rejected, and all **30 possible club
  fixtures** are checked to produce six legal, class-matched bouts.
- **AI legality**: cannot act while stunned, cannot leave the arena, cannot
  spend stamina or power it lacks, cannot damage the player out of reach.
- **Save tampering**: an edited standings table, an invented championship win
  and a bout naming a non-existent fighter are all rejected or recomputed.

## End-to-end tests — 14

| Test | Time | What it proves |
| --- | --- | --- |
| Stage 1 full journey | 54s | Title → map → club → fighter → dojo → all ten objectives with real key presses → season handover |
| **Stage 2 journey 1: full club event** | **4.9m** | Six bouts played **bout by bout with real key presses**, next-fighter transitions, club scoring, event result, refresh persistence |
| **Stage 2 journey 2: full season** | 5.0s | Five league events plus the championship final, standings, qualification, season-complete screen, refresh persistence |
| Fight HUD reports live engine values | 6.2s | Health/stamina/power/timer/round/club score all read from engine state; attacks measurably reduce opponent health |
| Arena at 1920/1440/1366/1280 | 7.4s | No horizontal overflow, timer and HUD visible at every size |
| Stage 1 save migrated forward | 0.9s | Muted-audio preference and training progress survive v1 → v3 |
| Bout pause and resume | 2.3s | Pause freezes combat; `Esc` works from the canvas |
| Season screen | 1.7s | Six events, six-row standings, simulation note visible |
| Stage 1: audio persistence, keyboard map, corrupt save, resume, dojo pause, overflow | ~12s | Preserved Stage 1 behaviour |

Journey 2 resolves bouts through a deterministic simulation hook. That hook
builds the **same** `MatchEngine`, drives **both** corners with the **same**
`OpponentAI`, and records results through the **same** store action the fight
screen calls — it steps the fixed timestep in a tight loop instead of once per
animation frame. It cannot set a result, award a bout or edit any resource.

## Failures found and fixed

| # | Failure | Root cause | Fix |
| --- | --- | --- | --- |
| 1 | Jump attacks passed over a standing opponent | Attack band measured upward from the attacker's feet, so from the top of the arc it was entirely above the target | Jump attack band extended downward (`lowEdge: -0.85`) |
| 2 | Power meter unreachable | ~17 clean light hits to fill, but ~16 was a knockout | Power gain per hit raised across the move table; a full meter is now ~10 clean hits |
| 3 | Strong attack could not land from light-attack range | Hit test used a single point at maximum reach | Attack now sweeps the interval from the body to the reach limit |
| 4 | Stage 1 journey failed after roster re-cast | Spec referenced 'Andrew Gillian' and 'cathryn' | Updated to the current cast |
| 5 | Stage 1 journey asserted a retired screen | Stage 1 now hands over to the real season | Assertion updated to the season schedule |
| 6 | Keyboard map test intermittently failed | Marker activation stole focus a frame later via `requestAnimationFrame` | Focus move made synchronous |
| 7 | AI reported a stale intent while stunned | Button-release frame was checked before the stun check | Stun and defeat now outrank the release frame |
| 8 | Standalone bundle logged load failures | Character portraits are separate files and are absent | Check now tolerates portrait requests specifically, still fails on any other request or page error |

## Visual review — 19 screenshots

Captured at 1280×720 and 1366×768 (`e2e/_screens.spec.ts`), inspected
individually. Defects found and fixed:

| Defect | Fix |
| --- | --- |
| **Referee drawn on top of the fighters** | Moved to the back-left of the mat at 0.46 scale |
| **Fighters standing among the crowd** | Arena recomposed: floor line raised, crowd barrier added, foot line moved 140 units down the mat |
| **Empty coloured boxes for side banners** | Now carry the two club names and hang from visible rails |
| **"Fight" announcement covering the banner** | Moved to the empty foreground apron |
| Motif lines cutting through the banners | Motif raised to sit between banners and crowd |
| League position shown as "3rd" before any event | Shows "—" until a result exists |
| Stale "special abilities are descriptive" note | They now scale the power attack; text corrected |

Remaining visual note: fighters occupy ~28% of arena height. Legible and
correct, but a larger figure would read better. Not a defect; recorded in
`KNOWN_LIMITATIONS.md`.

## Not covered

- **One browser engine.** Chromium only. Firefox and Safari unverified.
- **No visual regression baselines.** Screenshots are captured and reviewed by
  eye, not diffed. Three of the defects above would not have been caught by the
  automated suite.
- **The canvas renderers are not unit-tested.** Exercised in E2E; no assertion
  on pixel output beyond "the canvas is painted".
- **The audio manager is not unit-tested** — `jsdom` has no Web Audio.
- **No performance profiling** on low-end hardware.
- **`11-power-attack.png` not captured**: the scripted player could not fill the
  meter before the AI won the bout. The power attack itself is covered by unit
  tests and is reachable in play.
