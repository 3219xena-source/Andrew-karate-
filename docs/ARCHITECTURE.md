# Architecture

Stage 1 of Tasmania Martial Arts Championship. This document explains the system boundaries, the
data flow, and the reasoning behind the choices that would be expensive to reverse later.

---

## 1. Stack

| Concern | Choice | Reasoning |
| --- | --- | --- |
| Language | TypeScript, `strict` + `noUncheckedIndexedAccess` | Content is data-driven; the compiler is what stops a malformed record reaching a screen. |
| Build | Vite 7 | Fast, zero-config for this shape of project, static output. |
| UI | React 19 | Screens are forms and lists; the dojo is a canvas that React does not re-render. |
| State | Zustand | One store, no provider tree, and `getState()` works outside React — which the frame loop needs. |
| 2D combat | Custom canvas renderer + pure-TS engine | See §3. |
| Audio | Web Audio API, synthesised | See §5. |
| Persistence | `localStorage`, versioned | Stage 1 saves a few hundred bytes; IndexedDB would be ceremony without benefit. |
| Unit tests | Vitest + Testing Library | Same transform pipeline as the build. |
| E2E | Playwright | Drives the real combat engine with real key presses. |

### Why not Phaser

The brief suggested Phaser for 2D combat. Stage 1 has one player-controlled fighter, one static
practice target and no scene management, so Phaser's scene graph, physics and asset pipeline would
all go unused while adding a large dependency and a second rendering model to reason about.

The deciding factor was testability. Because the engine is a plain function of `(state, input, dt)`,
the entire ten-objective curriculum is played through headlessly in
`src/tests/tutorialEngine.test.ts` — no browser, no canvas, no timers. That test is the strongest
evidence that the tutorial is genuinely completable, and it would be substantially harder to write
against a framework that owns the game loop.

If Stage 2 or 3 needs scene management, particle systems or a tilemap, the engine can be kept and
only the renderer swapped, because the engine has no rendering knowledge at all.

### Why not 3D

The brief explicitly warns against choosing 3D because the description mentions realistic
characters. A stable, readable 2D side-view is the right medium for a sport-karate scoring game,
where what matters is distance, timing and whether a technique landed cleanly — all of which read
better in 2D than in an under-budgeted 3D scene.

---

## 2. Layers

```
                    ┌─────────────────────────────────────────────┐
                    │  content (src/data)                         │
                    │  teams · fighters · tutorial curriculum     │
                    └───────────────────┬─────────────────────────┘
                                        │ read-only
   ┌────────────────┐   snapshot   ┌────▼──────────┐   events   ┌────────────────┐
   │ InputManager   ├─────────────▶│ CombatEngine  ├───────────▶│ TutorialEngine │
   │ (keyboard)     │              │ (pure TS)     │            │ (sequencing)   │
   └────────────────┘              └────┬──────────┘            └───────┬────────┘
                                        │ state                         │ completions
                          ┌─────────────┴──────────┐                    │
                          ▼                        ▼                    ▼
                  ┌──────────────┐        ┌────────────────┐    ┌───────────────┐
                  │ canvas       │        │ AudioManager   │    │ gameStore     │
                  │ renderer     │        │ (Web Audio)    │    │ (Zustand)     │
                  └──────────────┘        └────────────────┘    └───────┬───────┘
                                                                        │
                                                        ┌───────────────┴────────┐
                                                        ▼                        ▼
                                                ┌───────────────┐        ┌──────────────┐
                                                │ screens       │        │ SaveManager  │
                                                │ (React)       │        │ localStorage │
                                                └───────────────┘        └──────────────┘
```

Dependencies point one way. The combat engine imports nothing but its own types, its constants and
the fighter data model. It does not know that React, canvas, audio or saving exist.

---

## 3. Combat engine

`src/systems/combat/combatEngine.ts`

A deterministic fixed-step state machine. `advance(elapsed, input)` accumulates real time into fixed
1/120s steps, so behaviour does not change with frame rate, and clamps oversized frames so a
backgrounded tab cannot teleport the fighter across the arena.

**What it owns:** position, facing, airborne state, the action state machine (idle, light, strong,
block, dodge, bow, stagger) with wind-up / active / recover phases, stamina and its regeneration,
hit detection against the practice pad, the pad's own strike cycle, combination detection, and an
outgoing event stream.

**What it deliberately does not own:** health, damage, rounds, scoring, referee rules, opponents.
Stage 1 does not need them, and building them speculatively would be Stage 2 work done blind.

**Per-fighter handling** comes from `deriveCombatProfile(fighter)`, which turns the authored ratings
into movement speed, jump velocity, stamina capacity and regeneration, guard drain, and attack and
dodge speed scaling. This is why the six fighters feel different despite sharing one moveset.

**Extending to two fighters.** `FighterState` is a plain struct and `CombatState` holds one of them
by name. Stage 2 adds a second `FighterState`, drives it from an AI controller that produces the same
`InputState` shape the keyboard produces, and extends `resolveAttack` to test the opponent's body box
as well as the pad. No rule in the engine needs to change to make that work.

### Event stream

The engine buffers events and the frame loop drains them once per frame. Both the tutorial and the
audio manager read the same stream, which is what keeps a sound cue and an objective tick in sync
without either system knowing about the other.

`dodge` (a dodge was performed) and `evade` (a dodge beat an incoming strike) are separate events on
purpose — otherwise the evasion objective could be satisfied by pressing the dodge key in an empty
room.

---

## 4. Tutorial engine

`src/systems/tutorial/tutorialEngine.ts` and `src/data/tutorial.ts`

The engine knows nothing about any particular objective. Objectives are declarative records carrying
their own instruction text, coach dialogue, completion target and a `measure(context)` function that
returns absolute progress. The engine activates them one at a time, feeds each the event stream, and
records completions.

Consequences of that split:

- Re-sequencing or extending the curriculum is a change to `src/data/tutorial.ts` alone.
- The engine is **resumable**: constructed with the objective ids already saved, it skips straight to
  the first outstanding one. That is how a player who refreshes mid-session lands back in the right
  place.
- Objective ids that no longer exist in the curriculum are ignored on load, so an old save cannot
  wedge the tutorial.
- A `measure` function that throws is caught and logged; the objective does not advance, but the
  player can still reset or leave the dojo. Nothing is swallowed silently.

Objectives declare `padStrikes` when they need the practice pad working, so the pad is quiet except
during the guard and evasion drills.

---

## 5. Audio

`src/systems/audio/`

Everything is synthesised at runtime. There are no audio files anywhere in the repository, which
removes sample licensing from the project entirely.

```
masterGain ─┬─ musicGain ── MusicPlayer (scheduled oscillators + filtered noise)
            └─ sfxGain   ── one-shot effects
```

- `synth.ts` renders the fourteen sound effects from enveloped oscillators and filtered noise bursts.
  The noise buffer is filled from a fixed pseudo-random sequence, so the game sounds identical every
  session.
- `music.ts` generates an original modal-pentatonic instrumental over a drone and a soft frame-drum
  pulse, using the standard look-ahead scheduling pattern so timing comes from the audio clock rather
  than `setInterval` jitter. It does not reproduce, quote or imitate any existing composition.
- `audioManager.ts` owns the single `AudioContext`, creates it lazily on the first user gesture
  (browsers block audio before that), applies settings as short gain ramps rather than instant jumps,
  and stops the music generator entirely when music is muted so muted music costs no CPU.

Every entry point is guarded: with no Web Audio implementation the game runs silently and says so in
Settings, rather than throwing.

---

## 6. State and persistence

`src/state/gameStore.ts`, `src/systems/save/`

One store holds the current screen, the player's selections, audio and accessibility preferences,
tutorial progress and the save-system status. Screens dispatch through actions; they never touch
`localStorage` or the audio manager directly.

**Persistence policy.** Every action that changes durable state writes the whole save synchronously.
The save is a few hundred bytes and writes are rare — a selection, a completed objective, a settings
change — so there is no debounce and no window in which a refresh loses progress. A failed write
flips `savePersisting` and raises a visible warning once; it is never silently ignored.

**Loading is defensive by design.** Missing storage, blocked storage, invalid JSON, a non-object
payload, an unknown version and individually corrupt fields all resolve to a usable save, and each
recovery path is reported through `SaveLoadResult.status` and surfaced to the player as a notice.

Two rules are worth calling out:

- **A fighter is validated against the live content**, and against the saved club. A save naming a
  fighter who has been removed, renamed, or who belongs to a different club, degrades to "nothing
  selected" rather than crashing a downstream screen.
- **The tournament unlock is derived, never trusted from disk.** `firstTournamentUnlocked` is
  recomputed from `stage1Complete`, which in turn requires `tutorialComplete`. A hand-edited save
  cannot unlock content the player has not completed.

**Migrations** (`migrations.ts`) apply in sequence from the stored version to the current one. There
are none yet — version 1 is the first published schema — but the machinery exists so the first schema
change is a data change rather than an architectural one.

---

## 7. Routing

Screen routing is a state machine (`ScreenId` in the store), not a URL router.

The Stage 1 journey is strictly linear, and the dojo holds meaningful in-memory state — a live combat
session — that a URL could not restore. Adding a router would create addressable states the game
cannot actually resume into. If deep linking becomes valuable, the `ScreenId` union is already the
route table.

Resumption is handled explicitly instead: `continueGame()` returns the player to the furthest point
the save can justify.

---

## 8. Rendering and the frame loop

`src/screens/DojoScreen.tsx` owns one `requestAnimationFrame` loop. Each frame it advances the
engine, drains events into audio and the tutorial, and paints the canvas.

React re-renders the HUD roughly twelve times a second, not sixty. The simulation and the canvas run
at the display's refresh rate inside the loop, so combat never waits on a React render, and the
objective list and stamina meter still feel live.

The renderer (`src/components/dojo/renderer.ts`) is a pure function of `(context, state, options)`.
It holds no state, so it can be called at any time and the simulation stays the single source of
truth. The arena is a fixed 1000×520 logical space scaled to whatever canvas size the layout
provides, which makes gameplay resolution-independent, and the drawing buffer is matched to the
device pixel ratio so the dojo is crisp on high-DPI displays.

---

## 9. Design system

`src/styles/design-system.css` owns every colour, type step, spacing unit, radius, shadow and
animation duration. `src/styles/screens.css` composes layouts from those tokens and introduces no new
colour values.

Three animation durations exist (`--motion-fast`, `--motion-base`, `--motion-slow`) and one easing
curve. Reduced motion is a class on `<html>`, applied from the player's Settings choice, which is
itself seeded from the operating system's `prefers-reduced-motion` on first run — so it also covers
modals and anything else rendered outside the app subtree.

---

## 10. Accessibility

- Every screen has a skip link, exactly one `<main>` landmark, and one `<h1>`.
- Map markers are real HTML buttons positioned over decorative SVG, not clickable SVG shapes, so they
  are reachable with `Tab`, activated with `Enter` or `Space`, and carry proper `aria-pressed` state.
- Fighter highlighting follows hover, keyboard focus and click identically, so the profile panel is
  never available to pointer users only.
- Ratings, stamina and tutorial progress are rendered as `role="meter"` with text values alongside.
  Nothing essential is communicated by colour alone; objective state is also given as text to screen
  readers ("— complete", "— in progress", "— not started").
- The modal traps focus, restores it on close, and closes on `Escape`.
- The dojo's input manager ignores game keys when a control is focused, so `Space` still activates a
  focused button and the arrow keys still drive a focused volume slider. `Escape` always pauses, so a
  player cannot be trapped.

Gaps are listed in [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).

---

## 11. Testing strategy

| Layer | Suite | What it proves |
| --- | --- | --- |
| Content | `data.test.ts` | Six clubs, six-fighter rosters, valid ratings, placeholder flags honest. |
| Rules | `combatEngine.test.ts` | Movement, attacks, stamina, block, dodge, combinations, frame-rate independence. |
| Curriculum | `tutorialEngine.test.ts` | All ten objectives complete through gameplay inputs, headlessly. |
| Persistence | `saveManager.test.ts` | Recovery from missing, malformed, hostile and out-of-date saves. |
| State | `gameStore.test.ts` | Navigation, selection, audio persistence, Stage 1 completion, reset. |
| Screens | `navigation.test.tsx` | The rendered flow, wiring, error states and accessibility affordances. |
| Journey | `e2e/stage1-journey.spec.ts` | The whole thing, in a browser, with real key presses. |

The tutorial and journey suites both play the session rather than setting flags. That is deliberate:
a test that sets `tutorialComplete = true` proves nothing about whether a player could.
