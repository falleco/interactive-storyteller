# Agent Brief — Fit Puzzle

Godot mini-game template for Wonder Tales, embedded from React Native through
`libgodot`. This project is intentionally small: one portrait 2D puzzle scene,
one autoload bridge, generated item sprites, and local feedback sounds.

## Hard Version Pin

- **Godot version: 4.5.1 only.**
- Do not upgrade the project, export presets, scene format, import metadata, or
  UID sidecars with any other Godot version.
- If the editor, Godot MCP, export scripts, or CLI report anything other than
  `4.5.1`, fix the local toolchain before saving resources.
- `project.godot` may show feature tag `4.5`; that does not authorize a patch
  version change.

## Project Shape

```
project.godot       Godot config. Main scene is res://main.tscn.
main.tscn           Root Control scene for the embedded puzzle.
puzzle_game.gd      Drag-and-drop shape matching gameplay.
app_controller.gd   Autoload bridge for React Native/libgodot.
assets/items/       The 10 runtime item sprites and their .import files.
assets/holes/       Clean target silhouettes derived from item alpha.
assets/ui/          UI-only sprites such as the idle hint hand.
assets/audio/       Local WAV feedback sounds and their .import files.
export_presets.cfg  Android and iOS export presets.
icon.svg            Project icon.
```

There are no secondary demo scenes in the runtime. Keep the template focused on
the embedded puzzle unless the React Native integration needs a new surface.

`project.godot` registers:

- `run/main_scene="res://main.tscn"`
- `AppController="*res://app_controller.gd"` as an autoload singleton.
- Portrait viewport defaults: `390x844`, canvas item stretch, portrait handheld
  orientation.

## Gameplay

The game has a catalog of 10 clear, child-friendly objects, but each round uses
only **3 randomly selected items**. The child drags each active item to its
matching silhouette. Correct placement snaps the item into the target, plays a
success sound, and bursts confetti. Wrong placement plays a short error sound,
vibrates if enabled, flashes red, and returns the item to its start position.
Completing the 3 active items emits completion and shows the celebration label.

Each new scene load and every `reset_round()` selects a fresh 3-item subset,
assigns those items to target slots, and shuffles their tray order. This is
intentional: a child should match shapes, not memorize a fixed set or
left-to-right order.

If the child does nothing for `IDLE_HINT_DELAY_SECONDS` (currently 5 seconds),
the game shows a small white glove hand over one unplaced active sticker and
animates it toward that sticker's target. Any touch, drag, correct placement, or
wrong placement hides the hint and restarts the idle timer.

Current catalog item ids:

```text
star, cake, basket, toy_car, teddy_bear, beach_ball, apple, rocket, umbrella, sun
```

The catalog is currently static in `ITEM_DEFS` inside `puzzle_game.gd`.
`ROUND_ITEM_COUNT` controls how many items are active per round. If the host ever
needs dynamic item sets, add a typed host-callable configuration method and keep
the payload JSON-friendly.

Visual layout notes:

- Runtime items are sticker-style PNGs with transparent backgrounds and a thick
  white border.
- Target holes are separate silhouette PNGs in `assets/holes/`, not darkened
  copies of the color sprites. This keeps the puzzle readable for young kids.
- The lower tray contains the draggable stickers. The upper play area contains
  colored target pads and silhouettes.

## React Native / libgodot Contract

Use `AppController` as the stable host bridge. `puzzle_game.gd` registers itself
with `AppController` on `_ready()`, and `AppController` relays gameplay events.

### Host-Callable API

```gdscript
signal game_event(event_name: String, payload: Dictionary)

func reset_round(round_id: String = "default") -> bool
func set_feedback_enabled(sound_enabled: bool, haptics_enabled: bool) -> bool
```

`reset_round` returns `false` if the puzzle scene is not registered yet. On
success it selects a fresh active subset, clears placements, hides completion
UI, moves active pieces to new shuffled start positions, and emits `round_reset`.

`set_feedback_enabled` returns `false` if the puzzle scene is not registered yet.
On success it toggles Godot sound playback and device vibration feedback. Visual
feedback remains enabled.

### Runtime Inputs

| Input | Source | Behavior |
| --- | --- | --- |
| `InputEventScreenTouch` | Mobile touch down/up. | Starts or ends dragging a puzzle item. |
| `InputEventScreenDrag` | Mobile drag gesture. | Moves the active puzzle item under the finger. |
| Left mouse button / motion | Editor and desktop debug only. | Mirrors touch behavior for local testing. |
| Viewport resize | React Native/libgodot container. | Recomputes portrait layout from normalized positions. |

### Events

React Native should prefer listening to `AppController.game_event`. The scene
also emits specific signals for Godot-side tests/tools.

```gdscript
signal game_event(event_name: String, payload: Dictionary)
signal round_started(payload: Dictionary)
signal item_drag_started(payload: Dictionary)
signal item_placed(payload: Dictionary)
signal item_rejected(payload: Dictionary)
signal round_reset(payload: Dictionary)
signal game_completed(payload: Dictionary)
```

Every payload includes:

| Field | Type | Notes |
| --- | --- | --- |
| `event` | `String` | Same value as `event_name`, e.g. `item_placed`. |
| `timestampMs` | `int` | Godot `Time.get_ticks_msec()` when emitted. |
| `roundId` | `String` | Current round id, defaults to `default`. |

Event payloads:

| Event | When emitted | Extra fields |
| --- | --- | --- |
| `round_started` | Scene is ready and a 3-item round is selected. | `catalogItemIds: Array[String]`, `itemIds: Array[String]`, `startOrder: Array[String]` |
| `round_reset` | Host calls `reset_round`. | `catalogItemIds: Array[String]`, `itemIds: Array[String]`, `startOrder: Array[String]` |
| `item_drag_started` | Child picks up an item. | `itemId: String` |
| `item_placed` | Item is released close enough to its matching shape. | `itemId`, `placedCount`, `totalItems` |
| `item_rejected` | Item is released away from its matching shape. | `itemId`, `placedCount`, `totalItems` |
| `game_completed` | All items are correctly placed. | `placedCount`, `totalItems` |

Example payload:

```gdscript
{
	"event": "item_placed",
	"timestampMs": 123456,
	"roundId": "story-page-4-fit-puzzle",
	"itemId": "star",
	"placedCount": 1,
	"totalItems": 10,
}
```

`itemIds` are only the active items for the current round. `catalogItemIds` lists
everything available in the local catalog. `startOrder` is the visible tray order
from left to right after the shuffle. These are intended for analytics/debugging;
React Native should not use them to drive matching logic.

Bridge rules:

- React Native should not infer success or failure by inspecting visuals; use
  `item_placed`, `item_rejected`, and `game_completed`.
- Keep event names stable. Add optional payload fields instead of changing or
  removing existing fields.
- Keep host parameters and event payload values JSON-friendly: strings, numbers,
  booleans, arrays, and dictionaries.
- Avoid app-specific navigation, auth, networking, or persistence in Godot.

## Assets

- Runtime item sprites live directly under `assets/items/`.
- Runtime target silhouettes live directly under `assets/holes/`.
- Runtime UI sprites live directly under `assets/ui/`.
- Runtime sounds live directly under `assets/audio/`.
- Keep `.import` files for committed assets. They carry Godot import settings and
  are part of the reproducible project state.
- Do **not** use a sprite atlas for puzzle items. The original atlas approach
  caused neighboring objects to bleed into each other when cropped. Generate
  one source image per item, then commit only the final transparent sticker PNG.
- Each item sprite should be one centered object only, with generous transparent
  padding and a visible white sticker border.
- Derive matching hole sprites from the final item alpha so shape targets stay
  aligned with the draggable item.
- Keep runtime item and hole PNGs at `512x512` unless there is a measured reason
  to increase them; the game renders them much smaller on mobile.
- Keep UI helper sprites, such as `assets/ui/hand_hint.png`, transparent,
  lightweight, and visually legible on both bright and white backgrounds.
- If item PNGs, hole PNGs, or WAV files change, run Godot `--import` with the
  pinned 4.5.1 editor before validating rendered output.
- Intermediate generated source files, chroma-key sources, contact sheets, and
  render previews are intentionally not part of the runtime.
- Keep generated `.godot/` cache/editor state out of source control.

## Validation

Use focused checks:

```bash
/Applications/Godot.app/Contents/MacOS/Godot --version
/Applications/Godot.app/Contents/MacOS/Godot --headless --path /Users/falleco/projects/wondertales-ai/games/fit-puzzle --check-only --quit-after 2
```

In this sandbox, Godot headless may crash while writing `user://logs`; rerun the
same command outside the sandbox/escalated before treating that as a project
failure.

Godot MCP is useful for non-mutating access checks against:

```text
/Users/falleco/projects/wondertales-ai/games/fit-puzzle
```

Only use mutating MCP operations like `save_scene`, `create_scene`, or
`update_project_uids` after confirming the MCP runtime is Godot `4.5.1`.

Before handing off changes, verify:

- `main.tscn` still loads as the main scene.
- `puzzle_game.gd` passes Godot parse/check.
- `AppController.reset_round()` and `set_feedback_enabled()` still delegate to
  the registered puzzle scene.
- A new round has exactly `ROUND_ITEM_COUNT` active items and emits `itemIds`
  with that length.
- The idle hint hand appears after the configured delay without input, and any
  child action hides it.
- Event names and required payload fields remain stable.
- There are no references to removed demo files or source-only generated assets.

## Coding Style

- Use typed GDScript for new public methods and signals.
- Keep gameplay code in `puzzle_game.gd` unless a real shared abstraction is
  needed.
- Keep bridge code in `app_controller.gd`; do not make React Native reach into
  arbitrary child nodes when a stable autoload method/signal can do the job.
- Prefer normalized layout positions for mobile resizing.
- Keep effects lightweight: short tweens, small local audio, no blocking loads
  during drag.
