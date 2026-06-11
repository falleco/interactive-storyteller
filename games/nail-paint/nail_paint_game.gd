extends Control

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

const DEFAULT_COLORS := [
	"#FF5A8A",
	"#7C4DFF",
	"#29B6F6",
	"#66D36E",
	"#FFD23F",
	"#FF8A3D",
]
const DEFAULT_PATTERNS := ["plain", "dots", "stars", "hearts", "stripes"]
const PATTERN_LABELS := {
	"plain": "Liso",
	"dots": "Bolinhas",
	"stars": "Estrelas",
	"hearts": "Cores",
	"stripes": "Listras",
}
const DEFAULT_ROUND_ID := "default"
const COMPLETION_CELL_TARGET := 12
const BRUSH_RADIUS := 10.5
const BRUSH_SPACING := 5.4
const MIN_SAFE_MARK_RADIUS := 1.6
const SWATCH_SIZE := 46.0
const SWATCH_GAP := 10.0
const PATTERN_SIZE := 48.0

var _success_player: AudioStreamPlayer
var _wrong_player: AudioStreamPlayer
var _complete_player: AudioStreamPlayer

var _round_id := DEFAULT_ROUND_ID
var _sound_enabled := true
var _haptics_enabled := true
var _colors: Array[String] = []
var _patterns: Array[String] = []
var _selected_color_hex := DEFAULT_COLORS[0]
var _selected_pattern := "plain"
var _nail_has_color := false
var _completed := false
var _is_painting := false
var _active_pointer := -1
var _has_last_paint_point := false
var _last_paint_point := Vector2.ZERO
var _outside_nail_while_painting := false
var _painted_cells := {}
var _paint_dabs: Array[Dictionary] = []
var _color_swatches: Array[Dictionary] = []
var _pattern_swatches: Array[Dictionary] = []
var _nail_polygon: PackedVector2Array = []
var _nail_rect := Rect2()
var _finger_rect := Rect2()
var _elapsed := 0.0
var _layout_scale := 1.0
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	_rng.randomize()
	_colors = _default_colors()
	_patterns = _default_patterns()
	_build_audio()
	var app_controller := get_node_or_null("/root/AppController")
	if app_controller != null and app_controller.has_method("register_game"):
		app_controller.call("register_game", self)
	_reset_round_state(DEFAULT_ROUND_ID, "round_started")
	resized.connect(_layout_game)
	_layout_game()


func configure_palette(round_id: String = DEFAULT_ROUND_ID, color_hexes: Array = [], pattern_ids: Array = []) -> void:
	_round_id = round_id if not round_id.is_empty() else DEFAULT_ROUND_ID
	_colors = _clean_colors(color_hexes)
	_patterns = _clean_patterns(pattern_ids)
	if not _selected_color_hex in _colors:
		_selected_color_hex = _colors[0]
	if not _selected_pattern in _patterns:
		_selected_pattern = _patterns[0]
	_reset_round_state(_round_id, "palette_configured")


func reset_round(round_id: String = "") -> void:
	var next_round_id := _round_id if round_id.is_empty() else round_id
	_reset_round_state(next_round_id, "round_reset")


func _reset_round_state(round_id: String, event_name: String) -> void:
	_round_id = round_id if not round_id.is_empty() else DEFAULT_ROUND_ID
	_nail_has_color = false
	_completed = false
	_is_painting = false
	_active_pointer = -1
	_has_last_paint_point = false
	_outside_nail_while_painting = false
	_painted_cells.clear()
	_paint_dabs.clear()
	_emit_game_event(event_name, _round_payload())
	queue_redraw()


func set_selected_color(color_hex: String) -> bool:
	var normalized := _normalize_hex(color_hex)
	if normalized.is_empty() or not normalized in _colors:
		return false
	_selected_color_hex = normalized
	_emit_game_event("color_selected", _round_payload())
	queue_redraw()
	return true


func set_selected_pattern(pattern_id: String) -> bool:
	if not pattern_id in _patterns:
		return false
	_selected_pattern = pattern_id
	_emit_game_event("pattern_selected", _round_payload())
	queue_redraw()
	return true


func set_feedback_enabled(sound_enabled: bool, haptics_enabled: bool) -> void:
	_sound_enabled = sound_enabled
	_haptics_enabled = haptics_enabled


func _process(delta: float) -> void:
	_elapsed += delta
	queue_redraw()


func _draw() -> void:
	_layout_game()
	_draw_background()
	_draw_hand()
	_draw_nail()
	_draw_tray()
	_draw_progress()


func _build_audio() -> void:
	_success_player = _new_audio_player("res://assets/audio/success.wav")
	_wrong_player = _new_audio_player("res://assets/audio/wrong.wav")
	_complete_player = _new_audio_player("res://assets/audio/complete.wav")


func _new_audio_player(path: String) -> AudioStreamPlayer:
	var player := AudioStreamPlayer.new()
	player.stream = load(path) as AudioStream
	player.bus = "Master"
	add_child(player)
	return player


func _layout_game() -> void:
	if size.x <= 0.0 or size.y <= 0.0:
		return

	_layout_scale = min(size.x / 390.0, size.y / 844.0)
	var finger_width: float = minf(size.x * 0.46, 184.0 * _layout_scale)
	var finger_height: float = size.y * 0.56
	var finger_top: float = size.y * 0.105
	_finger_rect = Rect2(
		Vector2((size.x - finger_width) * 0.5, finger_top),
		Vector2(finger_width, finger_height)
	)

	var nail_width: float = finger_width * 0.66
	var nail_height: float = finger_height * 0.38
	var nail_top: float = finger_top + finger_height * 0.105
	_nail_rect = Rect2(
		Vector2(_finger_rect.get_center().x - nail_width * 0.5, nail_top),
		Vector2(nail_width, nail_height)
	)
	_nail_polygon = _make_nail_polygon(_nail_rect)
	_layout_swatches()


func _layout_swatches() -> void:
	_color_swatches.clear()
	_pattern_swatches.clear()

	var swatch_size := SWATCH_SIZE * _layout_scale
	var gap := SWATCH_GAP * _layout_scale
	var color_total_width := float(_colors.size()) * swatch_size + float(_colors.size() - 1) * gap
	var color_start_x := (size.x - color_total_width) * 0.5
	var color_y := size.y - 150.0 * _layout_scale
	for index in range(_colors.size()):
		_color_swatches.append({
			"rect": Rect2(Vector2(color_start_x + float(index) * (swatch_size + gap), color_y), Vector2.ONE * swatch_size),
			"colorHex": _colors[index],
		})

	var pattern_size := PATTERN_SIZE * _layout_scale
	var pattern_gap := 8.0 * _layout_scale
	var pattern_total_width := float(_patterns.size()) * pattern_size + float(_patterns.size() - 1) * pattern_gap
	var pattern_start_x := (size.x - pattern_total_width) * 0.5
	var pattern_y := size.y - 88.0 * _layout_scale
	for index in range(_patterns.size()):
		_pattern_swatches.append({
			"rect": Rect2(Vector2(pattern_start_x + float(index) * (pattern_size + pattern_gap), pattern_y), Vector2.ONE * pattern_size),
			"pattern": _patterns[index],
		})


func _make_nail_polygon(rect: Rect2) -> PackedVector2Array:
	var points := PackedVector2Array()
	var center := rect.get_center()
	var rx := rect.size.x * 0.5
	var ry := rect.size.y * 0.5
	for index in range(40):
		var angle := -PI * 0.5 + (float(index) / 40.0) * TAU
		var x_scale := 0.84 if sin(angle) > 0.35 else 1.0
		points.append(Vector2(center.x + cos(angle) * rx * x_scale, center.y + sin(angle) * ry))
	return points


func _draw_background() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(1.0, 0.97, 0.86))
	draw_rect(Rect2(Vector2.ZERO, Vector2(size.x, size.y * 0.68)), Color(0.76, 0.93, 1.0))
	draw_rect(Rect2(Vector2(0.0, size.y * 0.66), Vector2(size.x, size.y * 0.34)), Color(1.0, 0.84, 0.91))
	for index in range(16):
		var x := fposmod(float(index * 83) + sin(_elapsed * 0.4 + index) * 12.0, size.x)
		var y := fposmod(float(index * 47) + cos(_elapsed * 0.45 + index) * 9.0, size.y * 0.62)
		var radius := (8.0 + float(index % 4) * 4.0) * _layout_scale
		draw_circle(Vector2(x, y), radius, Color(1.0, 1.0, 1.0, 0.34))


func _draw_hand() -> void:
	var shadow := _finger_rect
	shadow.position += Vector2(0.0, 8.0 * _layout_scale)
	_draw_round_rect(shadow.grow(4.0 * _layout_scale), 56.0 * _layout_scale, Color(0.38, 0.2, 0.18, 0.15))
	_draw_round_rect(_finger_rect, 58.0 * _layout_scale, Color(0.98, 0.69, 0.52))
	_draw_round_rect(_finger_rect.grow(-8.0 * _layout_scale), 48.0 * _layout_scale, Color(1.0, 0.76, 0.59))
	var knuckle_y := _finger_rect.position.y + _finger_rect.size.y * 0.68
	draw_line(
		Vector2(_finger_rect.position.x + _finger_rect.size.x * 0.18, knuckle_y),
		Vector2(_finger_rect.position.x + _finger_rect.size.x * 0.82, knuckle_y),
		Color(0.74, 0.38, 0.32, 0.28),
		3.0 * _layout_scale
	)


func _draw_nail() -> void:
	var nail_base := Color(1.0, 0.89, 0.93)
	draw_colored_polygon(_nail_polygon, nail_base)
	if _paint_dabs.size() > 0:
		_draw_paint_dabs()
	_draw_nail_shine()
	draw_polyline(_closed_polyline(_nail_polygon), Color(0.55, 0.26, 0.38, 0.7), 3.0 * _layout_scale, true)


func _draw_nail_shine() -> void:
	var shine := PackedVector2Array([
		_nail_rect.position + Vector2(_nail_rect.size.x * 0.25, _nail_rect.size.y * 0.16),
		_nail_rect.position + Vector2(_nail_rect.size.x * 0.38, _nail_rect.size.y * 0.14),
		_nail_rect.position + Vector2(_nail_rect.size.x * 0.33, _nail_rect.size.y * 0.62),
		_nail_rect.position + Vector2(_nail_rect.size.x * 0.22, _nail_rect.size.y * 0.7),
	])
	draw_colored_polygon(shine, Color(1.0, 1.0, 1.0, 0.26))


func _draw_paint_dabs() -> void:
	for dab in _paint_dabs:
		_draw_paint_mark(dab)


func _draw_paint_mark(dab: Dictionary) -> void:
	var point := dab["pos"] as Vector2
	var radius := float(dab["radius"])
	var color := dab["color"] as Color
	var pattern_id := String(dab["pattern"])
	draw_circle(point, radius, color)
	match pattern_id:
		"dots":
			var dot_radius := radius * 0.18
			for offset in [Vector2(-0.28, -0.18), Vector2(0.26, -0.08), Vector2(-0.08, 0.26)]:
				draw_circle(point + offset * radius, dot_radius, Color(1.0, 1.0, 1.0, 0.82))
		"stars":
			_draw_star(point, radius * 0.55, Color(1.0, 0.95, 0.42, 0.9))
		"hearts":
			_draw_heart(point, radius * 0.58, Color(1.0, 0.95, 0.98, 0.86))
		"stripes":
			for index in range(3):
				var y := point.y + (float(index) - 1.0) * radius * 0.34
				draw_line(
					Vector2(point.x - radius * 0.62, y),
					Vector2(point.x + radius * 0.62, y + radius * 0.22),
					Color(1.0, 1.0, 1.0, 0.56),
					maxf(1.0, radius * 0.18),
					true
				)


func _draw_tray() -> void:
	var tray_rect := Rect2(Vector2(12.0 * _layout_scale, size.y - 184.0 * _layout_scale), Vector2(size.x - 24.0 * _layout_scale, 168.0 * _layout_scale))
	_draw_round_rect(tray_rect.grow(5.0 * _layout_scale), 28.0 * _layout_scale, Color(0.36, 0.2, 0.48, 0.16))
	_draw_round_rect(tray_rect, 24.0 * _layout_scale, Color(1.0, 1.0, 1.0, 0.78))
	for swatch in _color_swatches:
		_draw_color_swatch(swatch)
	for swatch in _pattern_swatches:
		_draw_pattern_swatch(swatch)


func _draw_color_swatch(swatch: Dictionary) -> void:
	var rect := swatch["rect"] as Rect2
	var color_hex := String(swatch["colorHex"])
	var selected := color_hex == _selected_color_hex
	_draw_round_rect(rect.grow(5.0 * _layout_scale), 16.0 * _layout_scale, Color(0.34, 0.18, 0.45, 0.26) if selected else Color(0.36, 0.46, 0.58, 0.16))
	_draw_round_rect(rect, 14.0 * _layout_scale, Color.html(color_hex))
	if selected:
		draw_circle(rect.get_center(), 6.5 * _layout_scale, Color.WHITE)


func _draw_pattern_swatch(swatch: Dictionary) -> void:
	var rect := swatch["rect"] as Rect2
	var pattern_id := String(swatch["pattern"])
	var selected := pattern_id == _selected_pattern
	_draw_round_rect(rect.grow(4.0 * _layout_scale), 15.0 * _layout_scale, Color(0.34, 0.18, 0.45, 0.25) if selected else Color(0.42, 0.48, 0.56, 0.13))
	_draw_round_rect(rect, 13.0 * _layout_scale, Color(0.98, 0.96, 1.0))
	var center := rect.get_center()
	match pattern_id:
		"plain":
			draw_circle(center, 11.0 * _layout_scale, Color.html(_selected_color_hex))
		"dots":
			for offset in [Vector2(-9, -7), Vector2(7, -5), Vector2(-4, 8), Vector2(10, 9)]:
				draw_circle(center + offset * _layout_scale, 3.4 * _layout_scale, Color(0.25, 0.2, 0.36))
		"stars":
			_draw_star(center, 12.0 * _layout_scale, Color(1.0, 0.73, 0.18))
		"hearts":
			_draw_heart(center, 12.0 * _layout_scale, Color(1.0, 0.25, 0.48))
		"stripes":
			for index in range(3):
				var y := rect.position.y + rect.size.y * (0.32 + float(index) * 0.18)
				draw_line(Vector2(rect.position.x + 12.0 * _layout_scale, y), Vector2(rect.end.x - 12.0 * _layout_scale, y), Color(0.25, 0.2, 0.36), 3.0 * _layout_scale, true)


func _draw_progress() -> void:
	var progress := minf(1.0, float(_painted_cells.size()) / float(COMPLETION_CELL_TARGET))
	var bar_rect := Rect2(Vector2(size.x * 0.25, 24.0 * _layout_scale), Vector2(size.x * 0.5, 10.0 * _layout_scale))
	_draw_round_rect(bar_rect, 6.0 * _layout_scale, Color(1.0, 1.0, 1.0, 0.52))
	_draw_round_rect(Rect2(bar_rect.position, Vector2(bar_rect.size.x * progress, bar_rect.size.y)), 6.0 * _layout_scale, Color(1.0, 0.73, 0.18))


func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		var touch := event as InputEventScreenTouch
		if touch.pressed:
			_handle_pointer_down(touch.position, touch.index)
		elif touch.index == _active_pointer:
			_handle_pointer_up(touch.position)
	elif event is InputEventScreenDrag and (event as InputEventScreenDrag).index == _active_pointer:
		_handle_paint_motion((event as InputEventScreenDrag).position)
	elif event is InputEventMouseButton and (event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT:
		var mouse_button := event as InputEventMouseButton
		if mouse_button.pressed:
			_handle_pointer_down(mouse_button.position, 0)
		else:
			_handle_pointer_up(mouse_button.position)
	elif event is InputEventMouseMotion and _active_pointer == 0 and _is_painting:
		_handle_paint_motion((event as InputEventMouseMotion).position)


func _handle_pointer_down(point: Vector2, pointer_id: int) -> void:
	if _try_select_color(point) or _try_select_pattern(point):
		accept_event()
		return
	_is_painting = true
	_active_pointer = pointer_id
	_has_last_paint_point = false
	_outside_nail_while_painting = false
	if _point_in_nail(point):
		_apply_paint(point, "paint_started")
	else:
		_handle_outside_brush(point)
	accept_event()


func _handle_paint_motion(point: Vector2) -> void:
	if not _is_painting:
		return
	if _point_in_nail(point):
		_outside_nail_while_painting = false
		var event_name := "paint_started" if not _nail_has_color else "nail_painted"
		_apply_paint(point, event_name)
	else:
		_handle_outside_brush(point)
	accept_event()


func _handle_pointer_up(_point: Vector2) -> void:
	_is_painting = false
	_active_pointer = -1
	_has_last_paint_point = false
	_outside_nail_while_painting = false
	accept_event()


func _try_select_color(point: Vector2) -> bool:
	for swatch in _color_swatches:
		if (swatch["rect"] as Rect2).has_point(point):
			set_selected_color(String(swatch["colorHex"]))
			_play_sound(_success_player)
			return true
	return false


func _try_select_pattern(point: Vector2) -> bool:
	for swatch in _pattern_swatches:
		if (swatch["rect"] as Rect2).has_point(point):
			set_selected_pattern(String(swatch["pattern"]))
			_play_sound(_success_player)
			return true
	return false


func _apply_paint(point: Vector2, event_name: String) -> void:
	var before_cells := _painted_cells.size()
	if _has_last_paint_point:
		_paint_between(_last_paint_point, point)
	else:
		_stamp_brush(point)
	_last_paint_point = point
	_has_last_paint_point = true
	_nail_has_color = _paint_dabs.size() > 0

	if event_name == "paint_started" or _painted_cells.size() > before_cells:
		_play_sound(_success_player)
	_emit_game_event(event_name, _paint_payload(point))
	if not _completed and _painted_cells.size() >= COMPLETION_CELL_TARGET:
		_complete_round()
	queue_redraw()


func _handle_outside_brush(point: Vector2) -> void:
	_has_last_paint_point = false
	if not _outside_nail_while_painting:
		_outside_nail_while_painting = true
		_emit_rejected(point, false)


func _paint_between(from_point: Vector2, to_point: Vector2) -> void:
	var distance := from_point.distance_to(to_point)
	var steps: int = maxi(1, int(ceil(distance / (BRUSH_SPACING * _layout_scale))))
	for index in range(1, steps + 1):
		var point := from_point.lerp(to_point, float(index) / float(steps))
		if _point_in_nail(point):
			_stamp_brush(point)


func _stamp_brush(point: Vector2) -> void:
	var edge_distance := _distance_to_nail_edge(point)
	var radius := minf(BRUSH_RADIUS * _layout_scale, edge_distance - 0.6 * _layout_scale)
	if radius < MIN_SAFE_MARK_RADIUS * _layout_scale:
		return

	var cell_id := _cell_id_for_point(point)
	_painted_cells[cell_id] = true
	_paint_dabs.append({
		"pos": point,
		"radius": radius,
		"color": Color.html(_selected_color_hex),
		"pattern": _selected_pattern,
	})
	if _paint_dabs.size() > 260:
		_paint_dabs.pop_front()


func _emit_rejected(point: Vector2, feedback_enabled: bool = true) -> void:
	if feedback_enabled:
		_play_sound(_wrong_player)
	if feedback_enabled and _haptics_enabled:
		Input.vibrate_handheld(70)
	_emit_game_event("paint_rejected", {
		"roundId": _round_id,
		"x": point.x,
		"y": point.y,
		"reason": "outside_nail",
		"paintedCells": _painted_cells.size(),
		"completionTarget": COMPLETION_CELL_TARGET,
	})


func _complete_round() -> void:
	_completed = true
	_play_sound(_complete_player)
	_emit_game_event("game_completed", _round_payload())


func _play_sound(player: AudioStreamPlayer) -> void:
	if _sound_enabled and player != null:
		player.play()


func _point_in_nail(point: Vector2) -> bool:
	return Geometry2D.is_point_in_polygon(point, _nail_polygon)


func _can_add_dab(point: Vector2) -> bool:
	return _point_in_nail(point) and _distance_to_nail_edge(point) >= MIN_SAFE_MARK_RADIUS * _layout_scale


func _distance_to_nail_edge(point: Vector2) -> float:
	var best := INF
	for index in range(_nail_polygon.size()):
		var a := _nail_polygon[index]
		var b := _nail_polygon[(index + 1) % _nail_polygon.size()]
		best = minf(best, Geometry2D.get_closest_point_to_segment(point, a, b).distance_to(point))
	return best


func _cell_id_for_point(point: Vector2) -> String:
	var cell := 24.0 * _layout_scale
	var local := point - _nail_rect.position
	return "%d:%d" % [int(floor(local.x / cell)), int(floor(local.y / cell))]


func _draw_star(center: Vector2, radius: float, color: Color) -> void:
	var points := PackedVector2Array()
	for index in range(10):
		var r := radius if index % 2 == 0 else radius * 0.45
		var angle := -PI * 0.5 + float(index) * PI / 5.0
		points.append(center + Vector2(cos(angle), sin(angle)) * r)
	draw_colored_polygon(points, color)


func _draw_heart(center: Vector2, radius: float, color: Color) -> void:
	var points := PackedVector2Array()
	for index in range(26):
		var t := float(index) / 25.0 * TAU
		var x := 16.0 * pow(sin(t), 3.0)
		var y := -(13.0 * cos(t) - 5.0 * cos(2.0 * t) - 2.0 * cos(3.0 * t) - cos(4.0 * t))
		points.append(center + Vector2(x, y) * (radius / 18.0))
	draw_colored_polygon(points, color)


func _draw_round_rect(rect: Rect2, radius: float, color: Color) -> void:
	var diameter := radius * 2.0
	draw_rect(Rect2(rect.position + Vector2(radius, 0.0), Vector2(maxf(0.0, rect.size.x - diameter), rect.size.y)), color)
	draw_rect(Rect2(rect.position + Vector2(0.0, radius), Vector2(rect.size.x, maxf(0.0, rect.size.y - diameter))), color)
	draw_circle(rect.position + Vector2(radius, radius), radius, color)
	draw_circle(rect.position + Vector2(rect.size.x - radius, radius), radius, color)
	draw_circle(rect.position + Vector2(radius, rect.size.y - radius), radius, color)
	draw_circle(rect.position + Vector2(rect.size.x - radius, rect.size.y - radius), radius, color)


func _closed_polyline(points: PackedVector2Array) -> PackedVector2Array:
	var closed := points.duplicate()
	if closed.size() > 0:
		closed.append(closed[0])
	return closed


func _clean_colors(color_hexes: Array) -> Array[String]:
	var cleaned: Array[String] = []
	for value in color_hexes:
		var normalized := _normalize_hex(String(value))
		if not normalized.is_empty() and not normalized in cleaned:
			cleaned.append(normalized)
	if cleaned.is_empty():
		cleaned = _default_colors()
	return cleaned.slice(0, 8)


func _clean_patterns(pattern_ids: Array) -> Array[String]:
	var cleaned: Array[String] = []
	for value in pattern_ids:
		var pattern := String(value)
		if pattern in DEFAULT_PATTERNS and not pattern in cleaned:
			cleaned.append(pattern)
	if cleaned.is_empty():
		cleaned = _default_patterns()
	return cleaned


func _default_colors() -> Array[String]:
	var colors: Array[String] = []
	for color_hex in DEFAULT_COLORS:
		colors.append(String(color_hex))
	return colors


func _default_patterns() -> Array[String]:
	var patterns: Array[String] = []
	for pattern_id in DEFAULT_PATTERNS:
		patterns.append(String(pattern_id))
	return patterns


func _normalize_hex(value: String) -> String:
	var trimmed := value.strip_edges().to_upper()
	if trimmed.length() == 6:
		trimmed = "#" + trimmed
	if trimmed.length() != 7 or not trimmed.begins_with("#"):
		return ""
	for index in range(1, trimmed.length()):
		if not trimmed.substr(index, 1) in ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F"]:
			return ""
	return trimmed


func _round_payload() -> Dictionary:
	return {
		"roundId": _round_id,
		"colors": _colors,
		"patterns": _patterns,
		"selectedColor": _selected_color_hex,
		"selectedPattern": _selected_pattern,
		"hasColor": _nail_has_color,
		"paintedCells": _painted_cells.size(),
		"completionTarget": COMPLETION_CELL_TARGET,
		"isComplete": _completed,
	}


func _paint_payload(point: Vector2) -> Dictionary:
	var payload := _round_payload()
	payload["x"] = point.x
	payload["y"] = point.y
	payload["cellId"] = _cell_id_for_point(point)
	return payload


func _emit_game_event(event_name: String, payload: Dictionary) -> void:
	payload["event"] = event_name
	payload["timestampMs"] = Time.get_ticks_msec()
	game_event.emit(event_name, payload)

	match event_name:
		"round_started":
			round_started.emit(payload)
		"palette_configured":
			palette_configured.emit(payload)
		"color_selected":
			color_selected.emit(payload)
		"pattern_selected":
			pattern_selected.emit(payload)
		"paint_started":
			paint_started.emit(payload)
		"nail_painted":
			nail_painted.emit(payload)
		"paint_rejected":
			paint_rejected.emit(payload)
		"round_reset":
			round_reset.emit(payload)
		"game_completed":
			game_completed.emit(payload)
