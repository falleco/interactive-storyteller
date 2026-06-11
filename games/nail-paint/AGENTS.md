# Agent Brief — Nail Paint

Godot mini-game for Wonder Tales, embedded from React Native through
`@borndotcom/react-native-godot` / libgodot. This project is a portrait nail
painting game for young children: Godot renders one finger with a single nail,
plus color and pattern tools in the bottom tray.

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
project.godot          Godot config. Main scene is res://main.tscn.
main.tscn              Root Control scene for the embedded nail paint game.
nail_paint_game.gd     Nail painting gameplay, visuals, input, and events.
app_controller.gd      Autoload bridge for React Native/libgodot.
assets/audio/          Local WAV feedback sounds.
export_presets.cfg     Android and iOS export presets.
icon.svg               Project icon.
```

`project.godot` registers:

- `run/main_scene="res://main.tscn"`
- `AppController="*res://app_controller.gd"` as an autoload singleton.
- Portrait viewport defaults: `390x844`, canvas item stretch, portrait handheld
  orientation.

## Gameplay

The child paints a single fingernail. The finger itself is decorative and must
never receive visible paint. Selecting a color or pattern must not recolor the
nail automatically. Polish appears only where the child touches or drags, like a
brush stroke. Each brush mark is radius-clamped to stay inside the nail polygon;
outside movement pauses paint deposition without cancelling the active gesture.

Bottom tray tools:

- Color swatches select the active polish color.
- Pattern swatches select `plain`, `dots`, `stars`, `hearts`, or `stripes`.
- Touching/dragging inside the nail lays down brush marks using the active color
  and pattern.
- Touching/dragging the finger, background, or tray outside controls does not
  paint the scene and must not end the active touch gesture.

Completion is intentionally simple for children: the round completes after the
child paints enough unique nail cells (`COMPLETION_CELL_TARGET`). Completion
plays the celebration sound and emits `game_completed`; React Native can decide
whether to show a modal, advance story state, or let the child keep decorating.

Visual layout notes:

- Keep the bright, playful visual quality: sky, warm tray, large finger, clear
  nail shape, large swatches, and simple pattern icons.
- Keep controls and nail geometry viewport-derived, with stable dimensions.
- Keep full gameplay in the Godot scene. React Native should not implement touch
  overlays, masking, or painting logic for this game.

## React Native / libgodot Contract

Use `AppController` as the stable host bridge. `nail_paint_game.gd` registers
itself with `AppController` on `_ready()`, and `AppController` relays gameplay
events through `game_event`.

The `react-native-godot` README documents these bridge rules:

- Import `RTNGodot`, `RTNGodotView`, and `runOnGodotThread` from
  `@borndotcom/react-native-godot`.
- Use `RTNGodot.API()` as the TypeScript/JavaScript entry point to Godot APIs.
- Reach the scene tree/root through `Godot.Engine.get_main_loop().get_root()`.
- Call Godot methods from JS/TS on the Godot thread.
- Attach JS functions to Godot signals with `.connect(...)`.
- Run interaction code inside `runOnGodotThread(() => { "worklet"; ... })`.

Reference: https://github.com/borndotcom/react-native-godot#attach-to-signals

### Host-Callable API

```gdscript
signal game_event(event_name: String, payload: Dictionary)

func configure_palette(round_id: String = "default", color_hexes: Array = [], pattern_ids: Array = []) -> bool
func reset_round(round_id: String = "default") -> bool
func set_selected_color(color_hex: String) -> bool
func set_selected_pattern(pattern_id: String) -> bool
func set_feedback_enabled(sound_enabled: bool, haptics_enabled: bool) -> bool
```

`configure_palette` returns `false` if the game scene is not registered yet. On
success it sanitizes the host palette, resets the round, and emits
`palette_configured`. Colors must be CSS-style hex strings (`#RRGGBB` or
`RRGGBB`). Invalid colors are ignored; an empty palette falls back to defaults.
Patterns are allow-listed to `plain`, `dots`, `stars`, `hearts`, and `stripes`.

`reset_round` returns `false` if the game scene is not registered yet. On success
it clears nail color, brush progress, completion state, and emits `round_reset`.

`set_selected_color` and `set_selected_pattern` return `false` for invalid or
unavailable options. On success they update the active tool and emit
`color_selected` or `pattern_selected`.

`set_feedback_enabled` toggles Godot sound playback and handheld vibration.
Visual feedback remains enabled.

Example React Native worklet shape:

```ts
import { RTNGodot, runOnGodotThread } from "@borndotcom/react-native-godot";

runOnGodotThread(() => {
  "worklet";
  const Godot = RTNGodot.API();
  const root = Godot.Engine.get_main_loop().get_root();
  const appController = root.get_node("AppController");

  appController.configure_palette(
    "story-page-4-nail-paint",
    ["#FF5A8A", "#7C4DFF", "#29B6F6"],
    ["plain", "dots", "stars"],
  );

  appController.game_event.connect((eventName: string, payload: unknown) => {
    console.log(`[NailPaint] ${eventName}`);
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
| `configure_palette(...)` | React Native on the Godot thread. | Sets round id and available tools. |
| `reset_round(...)` | React Native on the Godot thread. | Clears brush marks and restarts progress. |
| `set_selected_color(...)` | React Native on the Godot thread or child tray tap. | Selects active polish color. |
| `set_selected_pattern(...)` | React Native on the Godot thread or child tray tap. | Selects active pattern. |
| `InputEventScreenTouch` | Mobile touch down/up. | Selects tray tools or starts/ends nail painting. |
| `InputEventScreenDrag` | Mobile drag gesture. | Paints while the pointer is inside the nail polygon; outside movement pauses paint without cancelling the gesture. |
| Left mouse button / motion | Editor and desktop debug only. | Mirrors touch behavior for local testing. |
| Viewport resize | React Native/libgodot container. | Recomputes portrait layout from viewport size. |

### Events

React Native should listen to `AppController.game_event`. The scene also emits
specific signals for Godot-side tests/tools.

```gdscript
signal game_event(event_name: String, payload: Dictionary)
signal round_started(payload: Dictionary)
signal palette_configured(payload: Dictionary)
signal color_selected(payload: Dictionary)
signal pattern_selected(payload: Dictionary)
signal paint_started(payload: Dictionary)
signal nail_painted(payload: Dictionary)
signal paint_rejected(payload: Dictionary)
signal round_reset(payload: Dictionary)
signal game_completed(payload: Dictionary)
```

Every payload includes:

| Field | Type | Notes |
| --- | --- | --- |
| `event` | `String` | Same value as `event_name`, e.g. `nail_painted`. |
| `timestampMs` | `int` | Godot `Time.get_ticks_msec()` when emitted. |
| `roundId` | `String` | Current round id, defaults to `default`. |
| `colors` | `Array[String]` | Available hex colors. |
| `patterns` | `Array[String]` | Available pattern ids. |
| `selectedColor` | `String` | Active hex color. |
| `selectedPattern` | `String` | Active pattern id. |
| `hasColor` | `bool` | Whether the nail has received at least one brush mark. |
| `paintedCells` | `int` | Unique in-nail cells touched this round. |
| `completionTarget` | `int` | Cell count needed for completion. |
| `isComplete` | `bool` | Whether `game_completed` has fired. |

Paint payloads also include `x`, `y`, and `cellId`. Rejection payloads include
`reason: "outside_nail"` and must not be interpreted as a failed game state; it
just means the child touched or dragged outside the nail. During a continuous
brush gesture, emit one outside rejection until the child re-enters the nail, and
do not use harsh sound/haptic feedback for that smooth boundary case.

Event meanings:

| Event | When emitted |
| --- | --- |
| `round_started` | Scene is ready with default palette. |
| `palette_configured` | Host calls `configure_palette(...)` successfully. |
| `round_reset` | Host calls `reset_round(...)` successfully. |
| `color_selected` | Child or host selects a valid color. |
| `pattern_selected` | Child or host selects a valid pattern. |
| `paint_started` | Child begins painting inside the nail polygon. |
| `nail_painted` | Child drags/touches another valid nail cell. |
| `paint_rejected` | Child touches or drags outside the nail polygon. |
| `game_completed` | Enough unique nail cells have been painted. |

Bridge rules:

- React Native should configure tools through `configure_palette(...)`, not by
  mutating arbitrary scene nodes.
- React Native should not infer success or failure by inspecting visuals; use
  `nail_painted`, `paint_rejected`, and `game_completed`.
- Keep event names stable. Add optional payload fields instead of changing or
  removing existing fields.
- Keep host parameters and event payload values JSON-friendly: strings, numbers,
  booleans, arrays, and dictionaries.
- Avoid app-specific navigation, auth, networking, or persistence in Godot.

## Assets

- Runtime sounds live directly under `assets/audio/`.
- Keep `.import` files for committed assets. They carry Godot import settings and
  are part of the reproducible project state.
- This game draws the finger, nail, swatches, and pattern icons with Godot canvas
  primitives; do not add image assets unless they materially improve the result.
- If WAV files or UI PNGs change, run Godot `--import` with the pinned 4.5.1
  editor before validating rendered output.
- Keep generated `.godot/` cache/editor state out of source control.

## Validation

Use focused checks:

```bash
/Applications/Godot.app/Contents/MacOS/Godot --version
/Applications/Godot.app/Contents/MacOS/Godot --headless --path /Users/falleco/projects/wondertales-ai/games/nail-paint --check-only --quit-after 2
```

In this sandbox, Godot headless may crash while writing `user://logs`; rerun the
same command outside the sandbox/escalated before treating that as a project
failure.

Before handing off changes, verify:

- `main.tscn` still loads as the main scene.
- `nail_paint_game.gd` passes Godot parse/check.
- `AppController.configure_palette(...)`, `reset_round(...)`,
  `set_selected_color(...)`, `set_selected_pattern(...)`, and
  `set_feedback_enabled(...)` delegate to the registered scene.
- Color and pattern tray taps select tools without painting the finger.
- `InputEventScreenTouch` / `InputEventScreenDrag` paint only inside the nail
  polygon.
- Dragging out of the nail does not cancel the brush; dragging back in resumes
  painting with the same active touch.
- Selecting a color or pattern does not auto-fill or recolor the nail; existing
  marks keep their original color/pattern.
- Touches outside the nail emit `paint_rejected` and do not create visible paint.
- Event names and required payload fields remain stable.

## Coding Style

- Use typed GDScript for new public methods and signals.
- Keep gameplay code in `nail_paint_game.gd` unless a real shared abstraction is
  needed.
- Keep bridge code in `app_controller.gd`; do not make React Native reach into
  arbitrary child nodes when a stable autoload method/signal can do the job.
- Prefer viewport-derived layout positions for mobile resizing.
- Keep effects lightweight: small local audio, simple drawing, and no blocking
  loads during touch/drag.
