# Asset register

Every asset the game uses, its source, licence, attribution requirement and
replacement status.

## Summary

| Category | Count | Origin | In repo? | Attribution |
| --- | --- | --- | --- | --- |
| Music | 1 | Original, synthesised at runtime | No file | None |
| Sound effects | 23 | Original, synthesised at runtime | No file | None |
| Tasmania map | 1 | Original stylised vector, inline SVG | No file | None |
| Arenas (6 venues) | 6 | Original, drawn procedurally | No file | None |
| Crowd, banners, referee | — | Original, drawn procedurally | No file | None |
| Club emblems | 6 | Procedural placeholder | No file | None |
| Fighter portraits | 36 | Procedural placeholder | No file | None |
| Character models | 1 set | Procedural | No file | None |
| **Supplied character art** | **5** | **Owner-supplied** | **NOT PRESENT — see below** | Owner to confirm |
| Fonts | 0 | Operating system stack | No file | None |
| Voice lines | 0 | None recorded | No file | n/a |

**Attribution currently required: none.** Nothing presently in the repository
carries an attribution obligation.

---

## Supplied character artwork — NOT YET IN THE REPOSITORY

Five character images were described to the project and five fighter records
already reference them. **The image files themselves are not in the repository
and have never been on the build machine.** They were provided as chat
attachments, which cannot be written to disk. The repository was searched in
full — working tree, git history, remote branch and the whole filesystem — and
contains no character image files.

Consequently the game currently renders its generated placeholder portrait for
all six Hobart fighters. That is the designed fallback, not a fault.

| Expected file | Character | Class | Belt | Status |
| --- | --- | --- | --- | --- |
| `andrew-black-belt.png` | Andrew | Adult | Black | **Missing** |
| `alice-blue-belt.png` | Alice | Junior | Blue | **Missing** |
| `mr-graham-black-belt.png` | Mr Graham | Senior / masters | Black | **Missing** |
| `susan-gillan-black-belt.png` | Susan Gillan | Senior / masters | Black | **Missing** |
| `janet-blue-belt.png` | Janet | Adult | Blue | **Missing** |

Location: `public/assets/characters/team-tasmania/` (folder exists, with a
README stating the same contract).

**When the files are added**, each row above must be completed with: creator,
creation method, licence, ownership, whether attribution is required, and
confirmation that the project owner holds the right to distribute the image.
Alt text already exists on each fighter record (`artwork.altText`) and is used
wherever the portrait renders.

Provenance is modelled in the data: `artwork.method` is `supplied` for these
five and `procedural` for everything else, so the register can be regenerated
from the content rather than maintained by hand.

---

## Audio — all original, all generated at runtime

| Field | Value |
| --- | --- |
| Files | **None.** Everything is synthesised by the Web Audio API. |
| Source | Original, written for this project (`src/systems/audio/`) |
| Licence | Project licence (MIT) |
| Attribution | Not required |

**Music** (`music.ts`): an original modal-pentatonic instrumental over a drone
and a soft frame-drum pulse, scheduled against the audio clock at 84 BPM. It
does not reproduce, quote, sample, arrange or imitate any existing composition
or recording.

**Effects** (`synth.ts`): 23 effects built from enveloped oscillators and
filtered noise. The noise buffer is filled from a fixed pseudo-random sequence,
so the game sounds identical every session. Stage 1 menu and training cues plus
the Stage 2 competition set: `round-start`, `timer-warning`, `power-charge`,
`power-move`, `knockout`, `bout-win`, `bout-loss`, `event-win`, `championship`.

No sample libraries, no field recordings, no third-party audio of any kind.

---

## Visual — all original, all procedural

**Tasmania map** (`TasmaniaMap.tsx`): an original hand-authored vector in a
0–100 coordinate space. It is **not** survey data, and not traced from or
derived from satellite imagery, aerial photography, commercial map tiles,
OpenStreetMap or any licensed dataset. No mapping API is called at runtime; the
game makes no network requests at all.

**Arenas** (`arenaRenderer.ts`): six venues, each drawn from its own palette and
a distinct background motif (mountain ridge, heritage arches, coastal windows,
industrial trusses, timber hall, alpine lodge), plus deterministic crowd
silhouettes, hanging club banners, a competition mat and a match official. All
canvas primitives; no textures are loaded. The venues are fictional and make no
claim about any real building.

**Club emblems** (`Emblem.tsx`): a coloured gradient tile carrying a Unicode
geometric glyph, labelled as placeholder artwork in the accessibility tree.
**Requires commissioned artwork before production.**

**Fighter portraits** (`Portrait.tsx`): generated from initials and club colour,
captioned "Placeholder art". Replaced automatically per fighter as soon as a
`portraitAsset` path resolves.

**Character figures** (`arenaRenderer.ts`): one procedural animation set, posed
from the combat state machine, coloured from each fighter's gi, belt grade,
skin, hair and build. **Requires production character art before release.**

**Typography**: the operating system's own UI font stack. No web fonts are
downloaded and no font files are bundled.

---

## Third-party code

Shipped in the bundle: `react`, `react-dom`, `zustand` — all MIT.

Development only: `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`,
`jsdom`, `@testing-library/*`, `@playwright/test`, `@types/*` — MIT or
Apache-2.0. `npm audit` reports 0 vulnerabilities.

No dependency carries a copyleft obligation affecting distribution.

---

## Rule

**No asset enters this repository without a row in this table**, recording its
source, licence, ownership, attribution requirement and alt text.
