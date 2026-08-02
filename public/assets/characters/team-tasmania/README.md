# Team Tasmania character artwork

Drop the five supplied character images into this folder, using exactly these
file names. The game already references them; no code change is needed once the
files are here.

| File | Character | Class | Belt |
| --- | --- | --- | --- |
| `andrew-black-belt.png` | Andrew | Adult | Black |
| `alice-blue-belt.png` | Alice | Junior | Blue |
| `mr-graham-black-belt.png` | Mr Graham | Senior / masters | Black |
| `susan-gillan-black-belt.png` | Susan Gillan | Senior / masters | Black |
| `janet-blue-belt.png` | Janet | Adult | Blue |

## How the paths resolve

Records in `src/data/fighters.ts` store the path **relative**, as
`assets/characters/team-tasmania/<file>.png`. `Portrait.tsx` resolves it against
`import.meta.env.BASE_URL` at render time, so the same record works in
development, in the production build, and under a non-root deployment path.

Anything in `public/` is copied to the build output verbatim, so no import or
bundler configuration is involved.

## Until the files are added

`Portrait.tsx` falls back to the generated placeholder portrait — the fighter's
initials over their club colour, captioned "Placeholder art" — both when no path
is configured and when a configured image fails to load. A missing file
therefore degrades visibly and safely rather than showing a broken image.

## Before committing artwork

- Confirm you have the right to use and distribute each image.
- Add a row for each file to `docs/ASSET_REGISTER.md`, recording its source,
  licence, ownership and whether attribution is required.
- Alt text already lives on each fighter record (`artwork.altText`); update it
  if the artwork changes.
- PNG is expected. Portraits render at up to 9rem wide in the profile panel and
  are cropped from the top, so a head-and-shoulders-upward composition works
  best. Compress before committing — these are loaded by the browser directly.
