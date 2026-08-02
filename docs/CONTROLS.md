# Controls

Desktop keyboard. Every menu is fully operable with `Tab`, `Enter`/`Space` and
the arrow keys, and each screen starts with a "Skip to content" link.

## Competition bouts

| Key | Action |
| --- | --- |
| `A` / `D`  or  `←` / `→` | Move left and right |
| `W` / `↑` | Jump |
| `S` / `↓` | Crouch |
| `J` | Light punch |
| `K` | Strong punch |
| `U` | Light kick |
| `I` | Strong kick |
| `L` (hold) | Block |
| `Shift` | Dodge |
| `Space` | Power attack — needs a full meter |
| `P` / `Esc` | Pause |

Attacks are **context sensitive**: any attack button thrown while airborne
becomes a jump attack, and any thrown while crouching becomes a crouch attack.

Defined once in `src/systems/input/fightInput.ts`. The in-game control panel and
this table are rendered from the same source, so they cannot drift apart.

## Training dojo (Stage 1)

| Key | Action |
| --- | --- |
| `A` / `D`  or  `←` / `→` | Move left and right |
| `W` / `↑` / `Space` | Jump |
| `J` | Light attack |
| `K` | Strong attack |
| `L` (hold) | Block |
| `Shift` | Dodge |
| `B` | Bow |
| `R` | Reset position |
| `Esc` / `P` | Pause |

Defined in `src/systems/input/inputManager.ts`.

## Input behaviour

- Only **bound** keys have their default suppressed, so the page never scrolls
  under you mid-round but browser shortcuts still work.
- Game keys are ignored while a menu control has focus, so `Space` still
  activates a focused button and the arrow keys still drive a focused slider.
- `Esc` always pauses, even from a focused control, so you cannot be trapped.
- Every held key is released on window blur, so alt-tabbing cannot leave a key
  stuck down.

## Not implemented

Gamepad support, touch controls and key remapping. The bindings live in a single
table specifically so these can be added without touching the combat code.
