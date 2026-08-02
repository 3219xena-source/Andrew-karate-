# Stage 2 — recommended plan

Stage 1 delivered the training prototype. Stage 2 turns it into a match. This is a controlled plan:
each phase is independently shippable and leaves the game in a working state.

The guiding constraint is the one that made Stage 1 work — **the combat engine stays pure**. Every
addition below is either a second `FighterState` in the same struct, a new rules module that reads
the engine's output, or a new screen. None of them require the engine to learn about React, canvas or
audio.

---

## Phase 1 — The first opponent

**Goal:** a second fighter exists in the arena and can be hit.

- Extend `CombatState` from `fighter` to `fighters: [FighterState, FighterState]`, keeping the
  existing single-fighter accessors as thin wrappers so nothing breaks in one commit.
- Generalise `resolveAttack` to test both the practice pad and the opposing fighter's body box.
- Add a **contact-control** model rather than damage: a landed technique registers as a *scoring
  contact* with a power class and a target zone. There is still no health and no injury state — that
  is a deliberate, permanent property of this game, not a Stage 1 shortcut.
- Add a shared reaction state (the existing `stagger`) for the receiving fighter.

**Exit criteria:** two fighters share the arena, techniques register against each other, and the
existing tutorial still passes unchanged.

**Risk:** the temptation to add health here. Resist it — scoring is the model.

---

## Phase 2 — Opponent AI

**Goal:** the opponent plays a recognisable game of karate.

- Drive the second fighter through the **same `InputState` interface** the keyboard produces. The AI
  is a function `(state, difficulty) => InputState`. This keeps it fully testable headlessly and means
  a human could take over the second fighter later with no engine change.
- Behaviour as a small state machine: *close distance → hold guard → look for an opening → commit →
  recover*. Three tunable parameters — reaction delay, aggression, guard discipline — which are also
  the difficulty knobs in Phase 8.
- Seed the AI's technique selection from the opponent's authored ratings, exactly as
  `deriveCombatProfile` already does for handling, so a Burnie fighter really does defend more.

**Exit criteria:** the opponent closes, guards, attacks and recovers, and never becomes unresponsive.
Unit tests drive the AI headlessly for thousands of steps and assert it never deadlocks.

---

## Phase 3 — Scoring and the referee

**Goal:** contacts become points under rules a player can understand.

- A `ScoringSystem` module that consumes the engine's event stream — it does not live inside the
  engine.
- Point values by technique class and control quality. Reward the combination timing the tutorial
  already teaches.
- A `RefereeSystem` for control (excessive contact gives the point away), out-of-area calls, and the
  restart procedure that returns both fighters to their marks.
- **The referee must enforce competition class.** `ageClassification` exists on every fighter and is
  currently unused; matchmaking must not pair a junior against an adult. Build this rule before the
  first bracket, not after.

**Exit criteria:** a scored exchange is legible on screen, and every point awarded can be traced to a
specific event.

---

## Phase 4 — Rounds, victory and defeat

**Goal:** a complete single match.

- Round timer, between-round reset, and a match state machine (ready → fighting → between → result).
- Victory and defeat screens that stay in character: a respectful bow-out, the score, and what was
  scored — not a taunt.
- Save the match record to the versioned save. **This is the first schema change**, so it is also the
  first real exercise of `migrations.ts` — write the version 1 → 2 migration properly and test it
  against a genuine Stage 1 save file.

**Exit criteria:** a player can fight one match start to finish, win or lose, and the result survives
a refresh.

---

## Phase 5 — Authoring the remaining rosters

**Goal:** thirty placeholder records become thirty real fighters.

- Five clubs × six fighters, written to the same standard as the Hobart roster and to the rules in
  [CHARACTERS.md](CHARACTERS.md).
- Delete `buildPlaceholderRoster` and the `isPlaceholder` flag once nothing uses them, and update the
  data tests that currently assert thirty placeholders exist.
- This is content work, not engineering, and can run in parallel with Phases 1–4.

**Exit criteria:** no fighter in the game carries `isPlaceholder: true`.

---

## Phase 6 — Tournament bracket

**Goal:** matches connect into a competition.

- A seeded six-club draw with a deterministic seed, so a bracket can be replayed and tested.
- Bracket progression persisted in the save, with the tournament placeholder screen replaced by the
  real thing.
- Separate junior and adult brackets, enforced by the Phase 3 class rule.

**Exit criteria:** a player can win the championship, and the bracket state survives a refresh at any
point.

---

## Phase 7 — Additional playable fighters

**Goal:** the roster differences are felt, not just read.

- Per-fighter movesets: give the defensive fighters a genuine counter window, the fast fighters a
  shorter dodge recovery.
- **Implement the named special abilities as mechanics.** They are currently descriptive, and the
  fighter panel says so. Making them real removes the honest-but-unsatisfying caveat.
- Per-fighter animation sets. `AnimationConfig.set` already exists for exactly this; add a second
  renderer that handles sprite sheets, keyed off that field.

**Exit criteria:** the fighter-select screen's promises match what happens in a match.

---

## Phase 8 — Difficulty and balancing

**Goal:** the game is fair at every level.

- Three difficulty levels driven by the Phase 2 AI parameters, plus assist options — slower opponent
  wind-ups, wider input windows — as accessibility features rather than "easy mode".
- A headless balance harness: run thousands of AI-versus-AI matches across every fighter pairing and
  report win rates. This is cheap because the engine is pure, and it is the only practical way to
  balance thirty-six fighters.

**Exit criteria:** no fighter pairing sits outside an agreed win-rate band.

---

## Carried-over debt to clear during Stage 2

Ordered by how much cheaper they are to fix now than later.

1. **Screen-reader narration of live combat.** The dojo is currently unusable without sight of the
   canvas. Adding an `aria-live` commentary channel is far easier while the event stream is small.
2. **Cross-browser verification.** Firefox and Safari are unverified. Do this before the audio and
   canvas surface area grows.
3. **Formal accessibility audit.** Automated axe pass plus assistive-technology testing.
4. **Gamepad support.** `KEY_BINDINGS` was built as a single table for this; add the Gamepad API as a
   second `InputState` source.
5. **Key remapping screen.** Same table, small screen.
6. **Visual regression baselines.** The one rendering bug found in Stage 1 (a missing head) was caught
   by looking at a screenshot, not by the suite. Baseline the screenshot helper.
7. **Renderer unit tests.** The renderer is pure; assert on a small offscreen canvas.
8. **Touch controls**, if mobile is in scope. This is a genuine design problem, not a port — decide
   before promising it.

---

## What to keep

Three Stage 1 decisions are load-bearing and should survive Stage 2 unchanged:

1. **The combat engine imports nothing but its own types.** This is what makes headless testing,
   AI-versus-AI balancing and the whole verification strategy possible.
2. **Content is data, not code.** Thirty new fighters should be thirty new records and zero component
   changes.
3. **Placeholders are labelled in the interface.** When Stage 2 inevitably ships with something
   incomplete, say so in the game — the tournament placeholder screen is the pattern to copy.
