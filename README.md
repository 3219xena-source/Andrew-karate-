# Tasmania Martial Arts Championship

A family-friendly sport-karate tournament game set across Tasmania. Six location-based clubs, a
selectable roster, and a guided training session in the dojo.

**This repository contains the Stage 1 vertical-slice prototype.** It delivers the complete early
player journey — title screen through to a saved Stage 1 completion — and a placeholder for the first
tournament match. It does not contain a playable tournament; see
[Known limitations](docs/KNOWN_LIMITATIONS.md) for exactly what is and is not built.

---

## The Stage 1 journey

1. Launch the game and view the title screen
2. Start a new game
3. Enter the Tasmania club-selection map
4. Select one of six location markers
5. Open the team profile
6. Review the six main fighters
7. Select a fighter
8. Enter the training dojo
9. Complete the ten-objective movement and combat tutorial
10. View the Stage 1 completion screen
11. Unlock the first tournament match (placeholder)

Progress, audio settings and accessibility settings are saved locally and survive a page refresh.

---

## Installation

Requires **Node.js 20 or newer** (developed and tested on Node 22).

```bash
npm install
```

## Running in development

```bash
npm run dev
```

Then open <http://127.0.0.1:5173>.

## Production build

```bash
npm run build     # type-checks, then bundles to dist/
npm run preview   # serves the built bundle at http://127.0.0.1:4173
```

The build is fully static — `dist/` can be served from any static host or opened behind any web
server. There is no backend and no network call at runtime.

## Tests

```bash
npm run typecheck   # TypeScript, strict mode, no emit
npm run test        # Vitest unit and component tests
npm run test:e2e    # Playwright end-to-end journey (builds and serves first)
npm run test:all    # all three, in order
```

`npm run test:e2e` downloads a Chromium build the first time it runs. If your environment already
provides one, point at it instead and nothing is downloaded:

```bash
PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium npm run test:e2e
```

To capture a screenshot of every screen (a developer utility, not part of the acceptance suite):

```bash
npx playwright test e2e/_screens.spec.ts
```

---

## Controls

| Key | Action |
| --- | --- |
| `A` / `D` or `←` / `→` | Move left and right |
| `W` / `↑` / `Space` | Jump |
| `J` | Light attack |
| `K` | Strong attack |
| `L` (hold) | Block |
| `Shift` | Dodge |
| `B` | Bow |
| `R` | Reset position |
| `Esc` / `P` | Pause |

The control table is defined once, in `src/systems/input/inputManager.ts`, and rendered from there in
both the dojo and the settings screen — so it cannot drift out of date.

Every menu is fully operable with the keyboard: `Tab` moves between controls, `Enter` or `Space`
activates them, and each screen begins with a "Skip to content" link.

---

## Repository structure

```
.
├── e2e/                      Playwright end-to-end suite
│   ├── stage1-journey.spec.ts    The acceptance journey and its supporting cases
│   └── _screens.spec.ts          Screenshot capture utility (excluded from the suite)
├── docs/
│   ├── ARCHITECTURE.md           System boundaries and data flow
│   ├── ASSET_REGISTER.md         Every asset, its source and its licence
│   ├── CHARACTERS.md             Fictionalisation policy and how to re-cast the roster
│   ├── KNOWN_LIMITATIONS.md      What is placeholder, what is missing, and why
│   └── STAGE2_PLAN.md            Recommended Stage 2 scope and sequence
├── src/
│   ├── main.tsx                  Entry point
│   ├── App.tsx                   Application shell and screen routing
│   ├── types/                    Data models: team, fighter, save
│   ├── data/                     Content: six clubs, fighters, tutorial curriculum
│   ├── state/gameStore.ts        Application state (Zustand) and persistence policy
│   ├── systems/
│   │   ├── audio/                Procedural music and sound synthesis
│   │   ├── combat/               Pure combat engine (no DOM)
│   │   ├── input/                Keyboard bindings and input snapshots
│   │   ├── save/                 Versioned save, sanitisation and migrations
│   │   └── tutorial/             Objective sequencing engine
│   ├── screens/                  One file per screen
│   ├── components/
│   │   ├── ui/                   Reusable primitives (Button, Meter, Modal, …)
│   │   ├── map/                  Tasmania map
│   │   └── dojo/                 Canvas renderer
│   ├── styles/                   Design tokens and screen layout
│   └── tests/                    Vitest suites
├── index.html
├── vite.config.ts                Build and Vitest configuration
└── playwright.config.ts
```

---

## Architecture at a glance

```
InputManager ──▶ CombatEngine ──▶ TutorialEngine ──▶ gameStore ──▶ SaveManager
                      │                                  │
                      ├──▶ canvas renderer               └──▶ screens (React)
                      └──▶ AudioManager
```

- **The combat engine is pure TypeScript.** No DOM, no React, no canvas — it is a deterministic
  `step(dt, input)` state machine, which is why the entire ten-objective curriculum can be played
  through headlessly in a unit test.
- **Content is data.** Teams, fighters and tutorial objectives are records in `src/data/`. No
  component contains a club name, a fighter biography or an objective instruction.
- **Persistence is explicit.** Every action that changes durable state writes the whole save
  synchronously, so there is no window in which a refresh loses progress.

Full detail in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Assets and licensing

There are **no binary assets in this repository** — no audio files, no images, no fonts.

- All music and sound effects are **synthesised at runtime** with the Web Audio API from original
  code in `src/systems/audio/`. Nothing is sampled from, or written to imitate, an existing
  recording or composition.
- The Tasmania map is an **original stylised vector** authored for this project. It is not derived
  from satellite imagery, commercial map tiles or any licensed dataset.
- Fighter portraits, team emblems and character models are **procedural placeholders**, generated
  from each record's configured colours and clearly labelled as placeholder art in the interface.
- Typography uses the operating system's own UI font stack. No web fonts are downloaded.

The full register, including what must be replaced before production, is in
[docs/ASSET_REGISTER.md](docs/ASSET_REGISTER.md).

---

## Characters

Every character is a **fictionalised game avatar**. Names, biographies, ratings, fighting styles and
appearances are game content only, and do not describe the real appearance, martial-arts ability,
health, personality or personal history of any real person.

The roster is designed to be re-cast: names, biographies and appearances all live in
`src/data/fighters.ts` and can be replaced without touching a single interface component. See
[docs/CHARACTERS.md](docs/CHARACTERS.md).

Junior characters train under supervision in a separate competition class. Combat is sport karate:
there is no health, no damage, no injury state, no blood, no weapons and no fatalities. An unblocked
practice strike produces a brief guard reset and nothing more.

---

## Privacy

The game stores only game progress and audio/accessibility preferences, in this browser's
`localStorage` under the key `tmac.save.v1`. No personal information is collected, and nothing is
transmitted anywhere — the game makes no network requests at runtime.

Clearing progress is available in **Settings → Progress → Reset progress**.

---

## Licence

MIT. See `package.json`.
