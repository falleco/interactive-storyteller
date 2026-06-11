# Agent Brief — Word Puzzle

Godot mini-game for Wonder Tales, embedded from React Native through
`@borndotcom/react-native-godot` / libgodot. This project is a portrait writing
game for young children: React Native provides a target word, usually a child's
name, and Godot renders draggable letter blocks plus blank slots for the child to
assemble the word in order.

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
main.tscn           Root Control scene for the embedded word puzzle.
puzzle_game.gd      Drag-and-drop letter writing gameplay.
app_controller.gd   Autoload bridge for React Native/libgodot.
assets/ui/          UI-only sprites such as the idle hint hand.
assets/audio/       Local WAV feedback sounds.
export_presets.cfg  Android and iOS export presets.
icon.svg            Project icon.
```

The old object/shape assets may still exist in the tree while this game evolves,
but runtime gameplay does not depend on item or hole sprites. Letters are drawn
with Godot UI nodes so the host can provide arbitrary child-friendly words.

`project.godot` registers:

- `run/main_scene="res://main.tscn"`
- `AppController="*res://app_controller.gd"` as an autoload singleton.
- Portrait viewport defaults: `390x844`, canvas item stretch, portrait handheld
  orientation.

## Gameplay

The game receives a target word, sanitizes it for play, and creates:

- One blank slot per target letter, laid out in reading order.
- One draggable block per target letter.
- A configurable number of random extra letter blocks to add difficulty.

The child drags each block from the lower tray to the correct slot. A placement
is accepted only when the dropped block is near an empty slot whose expected
letter matches the block letter. This keeps duplicate letters fair: any `A`
block can fill any currently open `A` slot, but it must still be dropped in a
slot whose position expects `A`.

Correct placement snaps the block into the slot, plays success audio, and emits
`letter_placed`. Wrong placement plays error audio, vibrates if enabled, emits
`letter_rejected`, and returns the block to the tray. The game completes when
all target slots are filled, plays celebration audio, emits `game_completed`,
and shows the local celebration label.

If the child does nothing for `IDLE_HINT_DELAY_SECONDS` (currently 5 seconds),
the game shows the hint hand moving from an unplaced required letter toward a
matching open slot. Any child action hides the hint and restarts the idle timer.

Word handling:

- Default word: `NOME`.
- `configure_word(...)` removes spaces, tabs, punctuation separators, hyphens,
  and underscores, uppercases the result, and caps it at `MAX_TARGET_LETTERS`.
- Empty sanitized input falls back to `NOME`.
- Accented characters are not stripped; if React Native passes `JOÃO`, the slots
  and required blocks use `J`, `O`, `Ã`, `O`.

Visual layout notes:

- Keep the bright, playful visual quality: sky, warm middle band, lower tray,
  rounded white slots, colorful letter blocks, soft shadows, and confetti.
- Blocks and slots use stable dimensions from viewport constraints. Hover,
  press, hint, and completion effects must not resize the layout.
- Keep the model word visible near the top so early writers can copy the target.
- Keep full gameplay in the Godot scene. React Native should not implement drag
  overlays or matching logic for this game.

## React Native / libgodot Contract

Use `AppController` as the stable host bridge. `puzzle_game.gd` registers itself
with `AppController` on `_ready()`, and `AppController` relays gameplay events
through `game_event`.

The `react-native-godot` README documents that:

- Import usage is `RTNGodot`, `RTNGodotView`, and `runOnGodotThread`.
- `RTNGodot.API()` is the TypeScript/JavaScript entry point to Godot APIs.
- Godot methods can be called from JS/TS after reaching the scene tree/root.
- JS functions attach to Godot signals with `.connect(...)`.
- Godot runs on its own thread, and the recommended interaction path is
  `runOnGodotThread(() => { "worklet"; ... })`.

Reference: https://github.com/borndotcom/react-native-godot#attach-to-signals

### Host-Callable API

```gdscript
signal game_event(event_name: String, payload: Dictionary)

func configure_word(target_word: String, round_id: String = "default", extra_letter_count: int = 4) -> bool
func reset_round(round_id: String = "default") -> bool
func set_feedback_enabled(sound_enabled: bool, haptics_enabled: bool) -> bool
```

`configure_word` returns `false` if the puzzle scene is not registered yet. On
success it sanitizes the word, creates required blocks and extra random blocks,
shuffles the tray, resets progress, and emits `word_configured`.

`reset_round` returns `false` if the puzzle scene is not registered yet. On
success it keeps the current target word, rebuilds and reshuffles the blocks,
clears placements, and emits `round_reset`.

`set_feedback_enabled` returns `false` if the puzzle scene is not registered yet.
On success it toggles Godot sound playback and device vibration feedback. Visual
feedback remains enabled.

Example React Native worklet shape:

```ts
import { RTNGodot, runOnGodotThread } from "@borndotcom/react-native-godot";

runOnGodotThread(() => {
  "worklet";
  const Godot = RTNGodot.API();
  const root = Godot.Engine.get_main_loop().get_root();
  const appController = root.get_node("AppController");

  appController.configure_word("LIA", "story-page-4-word-puzzle", 4);
  appController.game_event.connect((eventName: string, payload: unknown) => {
    console.log(`[WordPuzzle] ${eventName}`);
  });
});
```

When a signal callback needs to update React state, bridge back to JS with
`react-native-worklets-core` (`Worklets.createRunOnJS(...)`) from the mobile app.
Do not log raw Godot payload HostObjects directly with `console.log({ payload })`;
read primitive fields deliberately or log only the `eventName`.

### Runtime Inputs

| Input | Source | Behavior |
| --- | --- | --- |
| `configure_word(...)` | React Native on the Godot thread. | Sets the target word and difficulty. |
| `reset_round(...)` | React Native on the Godot thread. | Restarts the same word with a fresh tray shuffle. |
| `InputEventScreenTouch` | Mobile touch down/up. | Starts or ends dragging a letter block. |
| `InputEventScreenDrag` | Mobile drag gesture. | Moves the active letter block under the finger. |
| Left mouse button / motion | Editor and desktop debug only. | Mirrors touch behavior for local testing. |
| Viewport resize | React Native/libgodot container. | Recomputes portrait layout from viewport size. |

### Events

React Native should listen to `AppController.game_event`. The scene also emits
specific signals for Godot-side tests/tools.

```gdscript
signal game_event(event_name: String, payload: Dictionary)
signal round_started(payload: Dictionary)
signal word_configured(payload: Dictionary)
signal letter_drag_started(payload: Dictionary)
signal letter_placed(payload: Dictionary)
signal letter_rejected(payload: Dictionary)
signal round_reset(payload: Dictionary)
signal game_completed(payload: Dictionary)
```

Every payload includes:

| Field | Type | Notes |
| --- | --- | --- |
| `event` | `String` | Same value as `event_name`, e.g. `letter_placed`. |
| `timestampMs` | `int` | Godot `Time.get_ticks_msec()` when emitted. |
| `roundId` | `String` | Current round id, defaults to `default`. |
| `targetWord` | `String` | Sanitized uppercase target word where applicable. |

Round payload fields:

| Field | Type | Notes |
| --- | --- | --- |
| `targetLetters` | `Array[String]` | Required letters in slot order. |
| `availableLetters` | `Array[String]` | Required letters plus random extras in tray order. |
| `trayOrder` | `Array[String]` | Stable debug ids like `target_0:L`. |
| `extraLetterCount` | `int` | Number of random distractors. |

Progress payload fields:

| Field | Type | Notes |
| --- | --- | --- |
| `blockId` | `String` | Internal round block id. |
| `letter` | `String` | Letter printed on the dragged block. |
| `isExtra` | `bool` | True for random distractor blocks. |
| `slotIndex` | `int` | Present when the drop was near a slot. |
| `expectedLetter` | `String` | Present when `slotIndex` is present. |
| `placedCount` | `int` | Number of correctly filled slots. |
| `totalLetters` | `int` | Target word length. |
| `assembledWord` | `String` | Filled letters plus `_` for open slots. |

Event meanings:

| Event | When emitted |
| --- | --- |
| `round_started` | Scene is ready with the default word. |
| `word_configured` | Host calls `configure_word(...)` successfully. |
| `round_reset` | Host calls `reset_round(...)` successfully. |
| `letter_drag_started` | Child picks up a block. |
| `letter_placed` | Child drops a block on a matching open slot. |
| `letter_rejected` | Child drops a block away from a valid matching slot. |
| `game_completed` | All target slots are correctly filled. |

Bridge rules:

- React Native should pass the target word through `configure_word(...)`, not by
  mutating arbitrary scene nodes.
- React Native should not infer success or failure by inspecting visuals; use
  `letter_placed`, `letter_rejected`, and `game_completed`.
- Keep event names stable. Add optional payload fields instead of changing or
  removing existing fields.
- Keep host parameters and event payload values JSON-friendly: strings, numbers,
  booleans, arrays, and dictionaries.
- Avoid app-specific navigation, auth, networking, or persistence in Godot.

## Assets

- Runtime sounds live directly under `assets/audio/`.
- Runtime UI sprites live directly under `assets/ui/`.
- Keep `.import` files for committed assets. They carry Godot import settings and
  are part of the reproducible project state.
- Letter blocks are UI nodes, not image files. Do not add one PNG per letter
  unless there is a measured rendering reason.
- Keep UI helper sprites, such as `assets/ui/hand_hint.png`, transparent,
  lightweight, and visually legible on both bright and white backgrounds.
- If WAV files or UI PNGs change, run Godot `--import` with the pinned 4.5.1
  editor before validating rendered output.
- Keep generated `.godot/` cache/editor state out of source control.

## Validation

Use focused checks:

```bash
/Applications/Godot.app/Contents/MacOS/Godot --version
/Applications/Godot.app/Contents/MacOS/Godot --headless --path /Users/falleco/projects/wondertales-ai/games/word-puzzle --check-only --quit-after 2
```

In this sandbox, Godot headless may crash while writing `user://logs`; rerun the
same command outside the sandbox/escalated before treating that as a project
failure.

Before handing off changes, verify:

- `main.tscn` still loads as the main scene.
- `puzzle_game.gd` passes Godot parse/check.
- `AppController.configure_word(...)`, `reset_round(...)`, and
  `set_feedback_enabled(...)` delegate to the registered puzzle scene.
- A configured word creates one slot per target letter.
- The tray always includes every target letter plus the requested random extras.
- A letter can only be placed in an open slot expecting that letter.
- The idle hint hand appears after the configured delay without input, and any
  child action hides it.
- Event names and required payload fields remain stable.

## Coding Style

- Use typed GDScript for new public methods and signals.
- Keep gameplay code in `puzzle_game.gd` unless a real shared abstraction is
  needed.
- Keep bridge code in `app_controller.gd`; do not make React Native reach into
  arbitrary child nodes when a stable autoload method/signal can do the job.
- Prefer viewport-derived layout positions for mobile resizing.
- Keep effects lightweight: short tweens, small local audio, no blocking loads
  during drag.
