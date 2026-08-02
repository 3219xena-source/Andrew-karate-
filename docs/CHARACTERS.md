# Characters — fictionalisation policy and re-casting

## Policy

Every character in this game is a **fictionalised game avatar**.

Names, biographies, ratings, fighting styles, special abilities and appearances are game content
authored for a sport-karate video game. They do **not** describe, and must not be presented as
describing:

- the real appearance of any real person
- the real martial-arts ability, grade, record or training history of any real person
- the medical history, health or physical condition of any real person
- the personality, character or personal history of any real person

The title screen states this to the player, and the notice at the top of `src/data/fighters.ts`
states it to anyone editing the content.

### Rules for anyone extending the roster

1. **Do not add real biographical detail.** No real addresses, workplaces, schools, medical
   information, dates of birth, or anything that identifies a living person beyond a first name.
2. **Do not claim real achievement.** No real competition results, gradings or titles.
3. **Keep junior characters safe.** Junior fighters train in a supervised class. No adult-versus-child
   matchups, no injury depiction, no sexualisation, age-appropriate uniforms and dialogue.
4. **Keep it sport, not violence.** Contact is scored, never injurious. No blood, gore, fatalities,
   weapons, graphic injuries or cruelty.
5. **No stereotypes.** No cultural, racial, regional, gender or age stereotyping in any character or
   club record.
6. **Get permission where a real person inspired a character.** If a character is named after or
   inspired by a real person, that person (or their guardian, for a minor) should agree to the use of
   their name before the game is published or distributed.

---

## The featured roster

Six fighters at Hobart, all fully authored and playable. Every club in the
championship has six; this is simply the club the game offers first.

**Cathryn was retired** in save version 3 and Bea Halloran fills her junior
slot. Retiring rather than deleting matters: the save migration remaps every
reference — selected fighter, recorded bouts, active event and career records —
so no progress or event result is lost. See `docs/SAVE_MIGRATION.md`.

| Name | Role | Class | Style | Highest ratings |
| --- | --- | --- | --- | --- |
| Andrew | Club captain and lead fighter | Adult | Balanced karate | Technique 84, Stamina 79 |
| Alice | Junior squad member | Junior | Fast and agile karate | Agility 94, Speed 92 |
| Bea Halloran | Junior squad member | Junior | Defensive karate | Defence 88, Agility 80 |
| Mr Graham | Head coach and masters competitor | Senior | Traditional karate | Defence 90, Technique 88 |
| Janet | Fighter and team strategist | Adult | Technical karate and kung fu | Technique 91, Speed 79 |
| Susan Gillan | Senior mentor and masters competitor | Senior | Traditional defensive karate | Defence 89, Technique 85 |

Mr Graham additionally appears as the coach in the training dojo, delivering the tutorial's
instruction and feedback through the coach panel.

---

## How to re-cast the roster

All character content lives in `src/data/fighters.ts`. **No interface component contains a fighter
name, biography, role or rating** — so re-casting is a data change, and the tests will tell you if you
break the contract.

### Renaming a character

Edit the record's `name`. If you also want to change the identifier, edit `id` — but note that `id`
is what the save file stores, so an existing save will lose its fighter selection and fall back to
"nothing selected" (this is handled gracefully; it does not crash).

### Rewriting a biography or role

Edit `biography`, `role`, `relationship`, `fightingStyle` or `specialAbility`. Nothing else needs to
change.

### Changing appearance

Each record's `animation` block carries `giColour`, `beltColour` and `accentColour`, which drive both
the procedural dojo figure and the placeholder portrait. Set `portraitAsset` to a path to use real
artwork instead — `Portrait.tsx` already renders an image when one is configured, and falls back to
the placeholder if it fails to load.

### Changing ratings

Edit the `stats` block. Values are 1–100 and a test enforces that range. Ratings feed
`deriveCombatProfile`, so changing them genuinely changes how the fighter handles in the dojo.

### Moving a fighter to a different club

Edit `teamId`. The fighter will appear in that club's roster automatically. Note that a save holding
this fighter under the old club will drop the selection on load, by design.

### Replacing the whole roster

`FEATURED_ROSTER` in `src/data/fighters.ts` is a plain array. Replace it wholesale, keeping the
`Fighter` shape. Then update:

- `src/tests/data.test.ts` — it asserts the six expected names and which are junior class
- `src/data/tutorial.ts` — one coach line mentions Andrew by name
- `e2e/stage1-journey.spec.ts` — it selects fighters by test id

If you would rather load the roster from JSON or a CMS than from TypeScript, the whole content layer
is behind four functions (`getRoster`, `getFighter`, `isSelectableFighterId`, `getStrongestStats`).
Swapping the source means changing `src/data/fighters.ts` only.

---

## Club records

The six clubs live in `src/data/teams.ts` and follow the same rule: no component contains club text.
Each record carries its location, name, emblem colours, style, strength, personality, speciality,
description, status and map marker position.

Clubs are fictional organisations placed at real Tasmanian locations. Every description must remain
positive and professional. No Tasmanian location may be portrayed negatively.
