# Known limitations

An honest register of what Stage 1 does not do. Nothing in this list is hidden behind a placeholder
success message in the game itself — where a limitation is visible to the player, the interface says
so.

---

## 1. Placeholder features

These are visible in the game and labelled as placeholders in the interface.

| Feature | Status | Where it shows |
| --- | --- | --- |
| First tournament match | Unlock is real; the match is not built | Tournament screen, badged "Not implemented in Stage 1" |
| Five of six club rosters | Auto-generated placeholder records | Team panel badge "Roster in Stage 2"; each card badged "Placeholder" |
| Team emblems | Procedural glyph tiles | Labelled "(placeholder artwork)" to screen readers |
| Fighter portraits | Procedural initials | Captioned "Placeholder art" |
| Character models | One procedural animation set for all fighters | Fighter select notes the shared moveset |
| Special abilities | Descriptive text only | Stated on the fighter profile panel |
| Voice lines | None recorded | `voice.enabled` is `false` for every fighter |

---

## 2. Gameplay

**Only one club has an authored roster.** Hobart's six fighters are fully written. The other five
clubs have complete identities — name, style, strength, character, speciality, description — but
their six roster slots each are generated placeholders that exist so the data layer and navigation
can be exercised. Selecting one of those clubs opens a valid team profile that explains this and
offers a route to the featured club; it does not dead-end.

**All six featured fighters are playable, but they share one moveset.** The brief allowed one
playable fighter with the rest sharing a controller; all six are selectable and controllable. They
differ in handling — movement speed, jump height, stamina capacity and regeneration, guard drain,
attack and dodge speed are all derived from their authored ratings — but they perform the same
techniques with the same procedural animation set.

**Named special abilities are not implemented as mechanics.** "Quick Step", "Coach's Guard" and the
rest are descriptive in Stage 1. Ratings, not abilities, drive handling. The fighter profile panel
states this rather than implying the ability is active.

**There is no opponent.** No AI, no second fighter, no rounds, no timer, no referee, no scoring, no
victory or defeat states. This was a deliberate scope decision, not an oversight — Stage 1 is the
training prototype.

**There is no health or damage model, by design.** This is sport karate: contact is scored, never
injurious. A practice strike that is not blocked or evaded produces a brief guard-reset stagger and
nothing more. There is no health bar, no knockdown and no injury state anywhere in the engine.

**Walking past the practice pad is possible.** A technique thrown from the far side does not connect,
because the fighter is facing away. This is correct behaviour, but the dojo does not currently nudge
the player back into range or hint at it — a coaching line for that case is a small Stage 2 addition.

**The simulation clamps oversized frames.** Below roughly 30 frames per second the game runs slower
than real time rather than allowing techniques to tunnel through hit detection. This is the right
trade for correctness, but on very slow hardware it will feel sluggish rather than dropping frames.

---

## 3. Platform and input

**Desktop keyboard and mouse only.** The layout is responsive down to about 900px wide and the menus
work at that size, but the dojo has no touch controls. Playing the training session on a phone or
tablet is not supported in Stage 1.

**No gamepad support.** `KEY_BINDINGS` in `src/systems/input/inputManager.ts` is a single table
designed to make a second input source straightforward, but no Gamepad API integration exists.

**Key bindings are not remappable.** The table exists in one place for exactly this purpose; the
remapping screen is not built.

**Tested in Chromium.** The end-to-end suite runs against Chromium only. The code uses no
Chromium-specific API — Web Audio is behind a `webkitAudioContext` fallback and every browser API is
feature-detected — but Firefox and Safari have not been verified.

---

## 4. Accessibility

Implemented: keyboard navigation throughout, visible focus rings, skip links, one `<main>` and one
`<h1>` per screen, `role="meter"` with text values for every bar, text alternatives for all state
communicated by colour, pause capability, adjustable audio, reduced-motion support seeded from the
operating-system preference, and a focus-trapping modal that restores focus on close.

**Not yet implemented:**

- **No screen-reader narration of live combat.** The canvas is `role="application"` with the current
  objective as its label, and the objective list updates in an `aria-live` region, but the moment-to-
  moment action is not announced. The dojo is not usable by a player who cannot see the canvas.
- **No colour-blind palette option.** Contrast is high and no essential information is colour-only,
  but there is no dedicated deuteranopia/protanopia palette.
- **No text-size control in-game.** The interface uses relative units and respects browser zoom, but
  there is no in-game scaling setting.
- **No difficulty or assist options.** No slow-motion, no input-timing assistance, no objective skip.
  A player who cannot meet a timing window has no way past it other than retrying.
- **No captions or subtitles**, because there is no speech to caption yet. When voice lines are
  recorded, captions must ship with them.
- **The tutorial cannot be skipped.** There is a restart control but no skip, so Stage 1 completion
  requires performing every objective.
- **Formal audit not performed.** No automated axe/Lighthouse pass and no assistive-technology user
  testing has been done. The accessibility claims above are based on implementation and the
  keyboard/landmark assertions in the test suite, not on an audit.

---

## 5. Saving

**Single save slot.** One slot, keyed `tmac.save.v1` in `localStorage`. No profiles, no cloud sync,
no export or import.

**Progress is per-browser.** Clearing site data, using a different browser, or a private window
starts fresh. The game says so in Settings.

**Storage may be unavailable.** Where `localStorage` is blocked or full, the game runs normally in
memory and raises a visible warning that the session will not be restored. It does not pretend the
save succeeded.

**No migrations are written yet.** Version 1 is the first published schema. The migration chain runs
and is tested, but contains no entries. A save from a *newer* build is not readable: recoverable
settings are kept and the rest is reset, with the player told.

---

## 6. Content and representation

**Character records are fictionalised game avatars.** See [CHARACTERS.md](CHARACTERS.md). They do not
describe any real person's appearance, ability, health, personality or history. The title screen
states this to the player.

**Junior characters.** Ales and Cathryn are junior-class students who train under supervision in the
dojo. There is no adult-versus-child matchup anywhere in Stage 1, no injury animation, no graphic
impact and no sexualisation. Uniforms and dialogue are age-appropriate.

**Junior and adult competition classes are declared but not enforced.** `ageClassification` exists on
every fighter and is shown in the interface, but since Stage 1 has no matches, no matchmaking rule
consumes it. Stage 2 must enforce class separation before any competitive match is built.

**Club identities are fictional.** The six clubs are invented organisations placed at real Tasmanian
locations. Every description is positive and professional; no location is portrayed negatively and no
cultural, racial, regional, gender or age stereotypes are used.

**Marker positions are approximate.** The map is a stylised illustration, and marker positions are
laid out for legibility rather than geographic precision — the three north-coast markers in
particular are spread apart so their labels do not overlap.

---

## 7. Testing

**131 unit and component tests, 7 end-to-end tests, all passing.** The full ten-objective curriculum
is played through with gameplay inputs in both a headless unit test and a real browser.

**Not covered:**

- **No visual regression testing.** The screenshot helper (`e2e/_screens.spec.ts`) captures screens
  for review but does not compare them against baselines.
- **The canvas renderer is not directly tested.** It is a pure function and is exercised in the E2E
  run, but nothing asserts on pixel output. The missing-head bug found during development would not
  have been caught by the automated suite — it was found by inspecting a screenshot.
- **The audio manager is not unit-tested.** `jsdom` provides no Web Audio implementation. It is
  guarded against absence and exercised manually in the browser.
- **One browser engine only.** See §3.
- **No performance budget or profiling.** The game runs at 60fps on the development machine; no
  low-end hardware target has been measured.
- **No load or soak testing**, and no test of behaviour across an extended session.

---

## 8. Not built at all

For the avoidance of doubt, none of the following exists in this build: opponent AI, match rounds,
round timer, referee rules, scoring, tournament bracket, victory or defeat states, difficulty levels,
combo tables beyond the single scripted light-light-strong, online multiplayer, character
customisation, crowd simulation, cinematic sequences, kung-fu-specific animation sets, character
progression, unlockables beyond the single tournament placeholder, or any form of monetisation,
analytics or telemetry.
