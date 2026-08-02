# Known limitations

An honest register of what this build does not do. Nothing here is hidden
behind a placeholder success message in the game itself.

## 1. Blocking: the supplied character artwork is not in the repository

Five character images were specified and five fighter records reference them.
**The files are not present and never reached the build machine** — they were
provided as chat attachments, which cannot be written to disk. The working tree,
git history, the remote branch and the whole filesystem were searched.

Effect: all six Hobart fighters render the generated placeholder portrait. That
is the designed fallback and the game is fully playable, but the artwork
requirement is **not met**. See `docs/ASSET_REGISTER.md` and the README in
`public/assets/characters/team-tasmania/`.

## 2. Placeholders

| Feature | Status |
| --- | --- |
| Fighter portraits (all 36) | Procedural placeholder, captioned in the UI |
| Club emblems (all 6) | Procedural glyph tiles, labelled to assistive tech |
| Character models | One procedural animation set for every fighter |
| Voice lines | None recorded; `voice.enabled` is false for all 36 |

## 3. Gameplay

- **One moveset for everyone.** Fighters differ in handling — speed, reach,
  damage, toughness, stamina, guard drain — but throw the same seven techniques.
  Signature abilities scale the power attack's damage; they are not distinct
  moves.
- **No combo system.** Attacks can be chained by timing, but there is no
  authored combo table, no cancels and no links.
- **No health or injury model beyond the round.** Deliberate: this is sport
  karate. Health represents condition within a round and resets between rounds.
- **Rival-versus-rival fixtures are not played out.** Only the player's own ties
  are real bouts; the other four clubs' results each round come from a
  deterministic strength model. The standings screen says so in the interface.
- **The player is always seeded into the final** as the host club; the standings
  decide the opponent. The qualification screen reports whether the club also
  earned a top-two place on merit.
- **Fighters occupy about 28% of arena height.** Legible, but a larger figure
  would read better in a fighting game.
- **The AI does not learn or adapt**, within a bout or across a season, and has
  no awareness of the club score.

## 4. Platform and input

- **Desktop keyboard only.** No gamepad, no touch controls, no key remapping.
  Bindings live in a single table so each can be added without touching combat.
- **Chromium only.** Firefox and Safari are unverified. No browser-specific API
  is used and Web Audio has a `webkit` fallback, but this is untested.
- **Below ~30fps the simulation runs slower than real time** rather than letting
  attacks tunnel through hit detection. A deliberate correctness trade.

## 5. Accessibility

Implemented: full keyboard navigation, visible focus rings, skip links, one
`<main>` and one `<h1>` per screen, `role="meter"` with text values on every
bar, health condition given as a word as well as a bar, belt grade given as a
name as well as a colour, the player's own standings row marked with text,
pause, adjustable audio, reduced motion, and a screen-shake toggle.

**Not implemented:**

- **No screen-reader narration of live combat.** The canvas is
  `role="application"` with a descriptive label and announcements are in an
  `aria-live` region, but the moment-to-moment action is not announced. **A
  player who cannot see the canvas cannot fight a bout.**
- **No colour-blind palette option.** Contrast is high and nothing essential is
  colour-only, but there is no dedicated palette.
- **No difficulty assists** beyond the three AI bands — no slow motion, no input
  window widening, no bout skip.
- **No in-game text scaling** (browser zoom works).
- **No captions setting is wired** — `announcementCaptions` is stored and
  respected in the save but has no UI control yet.
- **No formal audit.** No axe or Lighthouse pass, no assistive-technology user
  testing. The claims above rest on implementation and test assertions.

## 6. Saving

- **One save slot**, in `localStorage`. No profiles, cloud sync, export or
  import.
- **A bout in progress is not saved.** Completed bouts in the event are kept; a
  refresh mid-bout restarts that bout from round one. Documented and tested.
- **A save from a newer build is not readable** — recoverable settings are kept,
  the rest resets, and the player is told.

## 7. Testing

See `docs/TEST_REPORT.md` for the full picture. Principal gaps: one browser
engine, no visual regression baselines, no renderer unit tests, no audio tests,
no performance profiling.

## 8. Automation hooks in the shipped build

`window.__tmac` exposes `startSeason`, `simulateBout`, `simulateEvent` and
`getScreen`. They exist so the end-to-end suite can complete a season without
hours of real-time play, and they drive the same engine, AI and store actions
the UI drives — they cannot set a result or edit any resource. They are present
in production builds and inert unless called.

## 9. Not built at all

Online multiplayer, character customisation, progression or unlockables beyond
the season, crowd simulation beyond silhouettes, cinematic sequences,
replays, a training mode against a live opponent, tournament formats other than
the six-event season, analytics, telemetry or monetisation of any kind.
