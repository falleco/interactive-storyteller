extends Control

signal game_event(event_name: String, payload: Dictionary)
signal round_started(payload: Dictionary)
signal word_configured(payload: Dictionary)
signal letter_drag_started(payload: Dictionary)
signal letter_placed(payload: Dictionary)
signal letter_rejected(payload: Dictionary)
signal round_reset(payload: Dictionary)
signal game_completed(payload: Dictionary)

const DEFAULT_TARGET_WORD := "NOME"
const DEFAULT_EXTRA_LETTER_COUNT := 4
const MIN_EXTRA_LETTER_COUNT := 2
const MAX_EXTRA_LETTER_COUNT := 8
const MAX_TARGET_LETTERS := 14
const BLOCK_BASE_SIZE := 64.0
const SLOT_BASE_SIZE := 66.0
const IDLE_HINT_DELAY_SECONDS := 5.0
const HINT_VISUAL_SIZE := 82.0
const SNAP_RADIUS_FACTOR := 0.82

const DISTRACTOR_LETTERS := [
	"A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "L", "M",
	"N", "O", "P", "R", "S", "T", "U", "V", "Z",
]

const BLOCK_COLORS := [
	Color(1.0, 0.76, 0.22),
	Color(1.0, 0.48, 0.67),
	Color(0.38, 0.82, 1.0),
	Color(0.56, 0.9, 0.36),
	Color(0.77, 0.54, 1.0),
	Color(1.0, 0.58, 0.28),
]

const CONFETTI_COLORS := [
	Color(1.0, 0.23, 0.36),
	Color(1.0, 0.74, 0.16),
	Color(0.18, 0.72, 1.0),
	Color(0.41, 0.86, 0.35),
	Color(0.74, 0.36, 1.0),
]

var _blocks_layer: Control
var _fx_layer: Control
var _model_label: Label
var _complete_label: Label
var _hint_hand: Sprite2D
var _success_player: AudioStreamPlayer
var _wrong_player: AudioStreamPlayer
var _complete_player: AudioStreamPlayer
var _hint_tween: Tween

var _target_word := DEFAULT_TARGET_WORD
var _target_letters: Array[String] = []
var _slots: Array[Dictionary] = []
var _blocks: Array[Dictionary] = []
var _dragging_block: Dictionary = {}
var _active_pointer := -1
var _drag_offset := Vector2.ZERO
var _layout_scale := 1.0
var _slot_size := SLOT_BASE_SIZE
var _block_size := BLOCK_BASE_SIZE
var _elapsed := 0.0
var _idle_seconds := 0.0
var _placed_count := 0
var _round_id := "default"
var _sound_enabled := true
var _haptics_enabled := true
var _last_tray_order: Array[String] = []
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	_rng.randomize()
	_build_nodes()
	var app_controller := get_node_or_null("/root/AppController")
	if app_controller != null and app_controller.has_method("register_game"):
		app_controller.call("register_game", self)
	_start_word_round(_target_word, _round_id, DEFAULT_EXTRA_LETTER_COUNT, "round_started")
	resized.connect(_layout_game)
	_layout_game()


func configure_word(target_word: String, round_id: String = "default", extra_letter_count: int = DEFAULT_EXTRA_LETTER_COUNT) -> void:
	_round_id = round_id
	_start_word_round(target_word, _round_id, extra_letter_count, "word_configured")


func reset_round(round_id: String = "") -> void:
	if not round_id.is_empty():
		_round_id = round_id
	_start_word_round(_target_word, _round_id, _current_extra_letter_count(), "round_reset")


func set_feedback_enabled(sound_enabled: bool, haptics_enabled: bool) -> void:
	_sound_enabled = sound_enabled
	_haptics_enabled = haptics_enabled


func _process(delta: float) -> void:
	_elapsed += delta
	_idle_seconds += delta
	_animate_idle()
	_update_idle_hint()
	queue_redraw()


func _draw() -> void:
	_draw_background(size)
	_draw_slots()
	_draw_progress(size)


func _build_nodes() -> void:
	_model_label = Label.new()
	_model_label.name = "TargetWordModel"
	_model_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_model_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_model_label.add_theme_color_override("font_color", Color(0.23, 0.16, 0.48))
	add_child(_model_label)

	_blocks_layer = Control.new()
	_blocks_layer.name = "LetterBlocks"
	_blocks_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_blocks_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_blocks_layer)

	_fx_layer = Control.new()
	_fx_layer.name = "CelebrationLayer"
	_fx_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fx_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_fx_layer)

	_complete_label = Label.new()
	_complete_label.text = "Muito bem!"
	_complete_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_complete_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_complete_label.add_theme_color_override("font_color", Color(0.28, 0.1, 0.75))
	_complete_label.visible = false
	_complete_label.modulate.a = 0.0
	add_child(_complete_label)

	_hint_hand = Sprite2D.new()
	_hint_hand.name = "IdleHintHand"
	_hint_hand.texture = load("res://assets/ui/hand_hint.png") as Texture2D
	_hint_hand.centered = true
	_hint_hand.visible = false
	_hint_hand.modulate.a = 0.0
	_hint_hand.z_index = 500
	_fx_layer.add_child(_hint_hand)

	_success_player = _new_audio_player("res://assets/audio/success.wav")
	_wrong_player = _new_audio_player("res://assets/audio/wrong.wav")
	_complete_player = _new_audio_player("res://assets/audio/complete.wav")


func _new_audio_player(path: String) -> AudioStreamPlayer:
	var player := AudioStreamPlayer.new()
	player.stream = load(path) as AudioStream
	player.bus = "Master"
	add_child(player)
	return player


func _start_word_round(target_word: String, round_id: String, extra_letter_count: int, event_name: String) -> void:
	_target_word = _sanitize_word(target_word)
	_target_letters = _letters_from_word(_target_word)
	_round_id = round_id
	_placed_count = 0
	_dragging_block = {}
	_active_pointer = -1
	_idle_seconds = 0.0
	_hide_idle_hint()
	_complete_label.visible = false
	_complete_label.modulate.a = 0.0

	for child in _blocks_layer.get_children():
		child.queue_free()
	for child in _fx_layer.get_children():
		if child != _hint_hand:
			child.queue_free()

	_slots = []
	for index in range(_target_letters.size()):
		_slots.append({
			"index": index,
			"letter": _target_letters[index],
			"pos": Vector2.ZERO,
			"rect": Rect2(),
			"occupiedBlockId": "",
		})

	_blocks = _build_letter_blocks(extra_letter_count)
	_shuffle_blocks()
	_model_label.text = _target_word
	_layout_game()
	_emit_game_event(event_name, _round_payload())


func _sanitize_word(value: String) -> String:
	var cleaned := ""
	for index in range(value.length()):
		var letter := value.substr(index, 1).to_upper()
		if letter in [" ", "\t", "\n", "-", "_", ".", ",", "'"]:
			continue
		cleaned += letter

	if cleaned.is_empty():
		cleaned = DEFAULT_TARGET_WORD
	if cleaned.length() > MAX_TARGET_LETTERS:
		cleaned = cleaned.substr(0, MAX_TARGET_LETTERS)
	return cleaned


func _letters_from_word(word: String) -> Array[String]:
	var letters: Array[String] = []
	for index in range(word.length()):
		letters.append(word.substr(index, 1))
	return letters


func _build_letter_blocks(extra_letter_count: int) -> Array[Dictionary]:
	var blocks: Array[Dictionary] = []
	for index in range(_target_letters.size()):
		blocks.append(_create_block_data("target_%d" % index, _target_letters[index], false, blocks.size()))

	var clamped_extra := clampi(extra_letter_count, MIN_EXTRA_LETTER_COUNT, MAX_EXTRA_LETTER_COUNT)
	for index in range(clamped_extra):
		var random_letter: String = DISTRACTOR_LETTERS[_rng.randi_range(0, DISTRACTOR_LETTERS.size() - 1)]
		blocks.append(_create_block_data("extra_%d" % index, random_letter, true, blocks.size()))
	return blocks


func _create_block_data(block_id: String, letter: String, is_extra: bool, visual_index: int) -> Dictionary:
	var panel := Panel.new()
	panel.name = "letter_%s_%s" % [letter, block_id]
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.pivot_offset = Vector2.ONE * BLOCK_BASE_SIZE * 0.5
	panel.z_index = 10

	var style := StyleBoxFlat.new()
	style.bg_color = BLOCK_COLORS[visual_index % BLOCK_COLORS.size()]
	style.border_color = Color.WHITE
	style.border_width_left = 4
	style.border_width_top = 4
	style.border_width_right = 4
	style.border_width_bottom = 4
	style.corner_radius_top_left = 18
	style.corner_radius_top_right = 18
	style.corner_radius_bottom_left = 18
	style.corner_radius_bottom_right = 18
	style.shadow_color = Color(0.14, 0.15, 0.26, 0.2)
	style.shadow_size = 7
	style.shadow_offset = Vector2(0.0, 4.0)
	panel.add_theme_stylebox_override("panel", style)

	var label := Label.new()
	label.name = "Letter"
	label.text = letter
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.add_theme_color_override("font_color", Color(0.16, 0.13, 0.27))
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.set_anchors_preset(Control.PRESET_FULL_RECT)
	panel.add_child(label)
	_blocks_layer.add_child(panel)

	return {
		"id": block_id,
		"letter": letter,
		"isExtra": is_extra,
		"placed": false,
		"slotIndex": -1,
		"start_pos": Vector2.ZERO,
		"panel": panel,
		"label": label,
		"style": style,
	}


func _shuffle_blocks() -> void:
	for index in range(_blocks.size() - 1, 0, -1):
		var swap_index := _rng.randi_range(0, index)
		var current_value := _blocks[index]
		_blocks[index] = _blocks[swap_index]
		_blocks[swap_index] = current_value


func _layout_game() -> void:
	if size.x <= 0.0 or size.y <= 0.0:
		return

	_layout_scale = min(size.x / 390.0, size.y / 844.0)
	_layout_model_label()
	_layout_slots()
	_layout_blocks()
	_layout_complete_label()

	if _hint_hand != null:
		_hint_hand.scale = Vector2.ONE * ((HINT_VISUAL_SIZE * _layout_scale) / 512.0)


func _layout_model_label() -> void:
	_model_label.position = Vector2(0.0, 44.0 * _layout_scale)
	_model_label.size = Vector2(size.x, 64.0 * _layout_scale)
	var font_size := int(clampf(44.0 * _layout_scale, 26.0, 50.0))
	if _target_letters.size() > 8:
		font_size = int(clampf(34.0 * _layout_scale, 22.0, 42.0))
	_model_label.add_theme_font_size_override("font_size", font_size)


func _layout_slots() -> void:
	var margin := 22.0 * _layout_scale
	var gap := 8.0 * _layout_scale
	var columns := mini(_target_letters.size(), 7)
	var rows := int(ceil(float(_target_letters.size()) / float(columns)))
	var available_width := size.x - margin * 2.0
	_slot_size = minf(SLOT_BASE_SIZE * _layout_scale, (available_width - gap * float(columns - 1)) / float(columns))
	_slot_size = maxf(42.0 * _layout_scale, _slot_size)

	var total_height := float(rows) * _slot_size + float(rows - 1) * gap
	var start_y := size.y * 0.225
	if rows > 1:
		start_y = size.y * 0.205

	for index in range(_slots.size()):
		var row := int(floor(float(index) / float(columns)))
		var col := index % columns
		var row_count := mini(columns, _slots.size() - row * columns)
		var row_width := float(row_count) * _slot_size + float(row_count - 1) * gap
		var start_x := (size.x - row_width) * 0.5
		var pos := Vector2(
			start_x + float(col) * (_slot_size + gap) + _slot_size * 0.5,
			start_y + float(row) * (_slot_size + gap) + _slot_size * 0.5
		)
		_slots[index]["pos"] = pos
		_slots[index]["rect"] = Rect2(pos - Vector2.ONE * _slot_size * 0.5, Vector2.ONE * _slot_size)


func _layout_blocks() -> void:
	var margin := 20.0 * _layout_scale
	var gap := 9.0 * _layout_scale
	var total := _blocks.size()
	var columns := mini(total, 6)
	var rows := int(ceil(float(total) / float(columns)))
	var available_width := size.x - margin * 2.0
	var available_height := size.y * 0.235
	_block_size = minf(BLOCK_BASE_SIZE * _layout_scale, (available_width - gap * float(columns - 1)) / float(columns))
	_block_size = minf(_block_size, (available_height - gap * float(rows - 1)) / float(rows))
	_block_size = maxf(42.0 * _layout_scale, _block_size)

	var start_y := size.y * 0.72 + maxf(0.0, (available_height - (float(rows) * _block_size + float(rows - 1) * gap)) * 0.5)
	for index in range(total):
		var row := int(floor(float(index) / float(columns)))
		var col := index % columns
		var row_count := mini(columns, total - row * columns)
		var row_width := float(row_count) * _block_size + float(row_count - 1) * gap
		var start_x := (size.x - row_width) * 0.5
		var pos := Vector2(
			start_x + float(col) * (_block_size + gap),
			start_y + float(row) * (_block_size + gap)
		)
		var block_data := _blocks[index]
		var panel := block_data["panel"] as Panel
		var label := block_data["label"] as Label
		panel.size = Vector2.ONE * _block_size
		panel.pivot_offset = panel.size * 0.5
		label.add_theme_font_size_override("font_size", int(_block_size * 0.56))
		block_data["start_pos"] = pos
		if bool(block_data["placed"]):
			var slot_index := int(block_data["slotIndex"])
			var slot_pos := _slots[slot_index]["pos"] as Vector2
			panel.position = slot_pos - panel.size * 0.5
		elif block_data != _dragging_block:
			panel.position = pos
			panel.scale = Vector2.ONE

	_last_tray_order = _tray_order()


func _layout_complete_label() -> void:
	_complete_label.position = Vector2(0.0, size.y * 0.515)
	_complete_label.size = Vector2(size.x, 70.0 * _layout_scale)
	_complete_label.add_theme_font_size_override("font_size", int(42.0 * _layout_scale))


func _draw_background(viewport_size: Vector2) -> void:
	draw_rect(Rect2(Vector2.ZERO, viewport_size), Color(1.0, 0.97, 0.86))
	draw_rect(Rect2(Vector2.ZERO, Vector2(viewport_size.x, viewport_size.y * 0.37)), Color(0.72, 0.91, 1.0))
	draw_rect(Rect2(Vector2(0.0, viewport_size.y * 0.37), Vector2(viewport_size.x, viewport_size.y * 0.31)), Color(1.0, 0.94, 0.75))
	draw_rect(Rect2(Vector2(0.0, viewport_size.y * 0.68), Vector2(viewport_size.x, viewport_size.y * 0.32)), Color(0.76, 0.93, 1.0))

	var bubble_colors := [
		Color(1.0, 0.55, 0.73, 0.35),
		Color(1.0, 0.88, 0.28, 0.35),
		Color(0.38, 0.84, 1.0, 0.34),
		Color(0.59, 0.92, 0.48, 0.32),
	]
	for index in range(18):
		var x := fposmod(float(index * 97) + sin(_elapsed * 0.7 + index) * 18.0, viewport_size.x)
		var y := fposmod(float(index * 53) + cos(_elapsed * 0.5 + index) * 12.0, viewport_size.y)
		var radius := (10.0 + float(index % 5) * 5.0) * _layout_scale
		draw_circle(Vector2(x, y), radius, bubble_colors[index % bubble_colors.size()])

	_draw_cloud(Vector2(viewport_size.x * 0.18, viewport_size.y * 0.12), 0.92 * _layout_scale)
	_draw_cloud(Vector2(viewport_size.x * 0.82, viewport_size.y * 0.13), 0.72 * _layout_scale)
	_draw_hill(Vector2(viewport_size.x * 0.22, viewport_size.y * 0.67), viewport_size.x * 0.62, Color(0.62, 0.91, 0.45, 0.82))
	_draw_hill(Vector2(viewport_size.x * 0.77, viewport_size.y * 0.68), viewport_size.x * 0.58, Color(0.38, 0.82, 0.55, 0.72))

	var tray_rect := Rect2(
		Vector2(14.0 * _layout_scale, viewport_size.y * 0.705),
		Vector2(viewport_size.x - 28.0 * _layout_scale, viewport_size.y * 0.265)
	)
	_draw_round_rect(tray_rect.grow(5.0 * _layout_scale), 28.0 * _layout_scale, Color(0.24, 0.58, 0.92, 0.18))
	_draw_round_rect(tray_rect, 24.0 * _layout_scale, Color(1.0, 1.0, 1.0, 0.68))
	draw_line(Vector2(24.0 * _layout_scale, viewport_size.y * 0.705), Vector2(viewport_size.x - 24.0 * _layout_scale, viewport_size.y * 0.705), Color(1.0, 0.72, 0.26, 0.5), 4.0 * _layout_scale)


func _draw_slots() -> void:
	for index in range(_slots.size()):
		var slot := _slots[index]
		var rect := slot["rect"] as Rect2
		var filled := not String(slot["occupiedBlockId"]).is_empty()
		var base_color := Color(1.0, 1.0, 1.0, 0.88) if filled else Color(1.0, 1.0, 1.0, 0.54)
		var outline_color := Color(0.56, 0.9, 0.36, 0.9) if filled else Color(0.28, 0.36, 0.68, 0.26)
		_draw_round_rect(rect.grow(5.0 * _layout_scale), 18.0 * _layout_scale, outline_color)
		_draw_round_rect(rect, 15.0 * _layout_scale, base_color)
		draw_circle(rect.position + Vector2(rect.size.x * 0.5, rect.size.y - 9.0 * _layout_scale), 3.4 * _layout_scale, Color(0.29, 0.34, 0.54, 0.18))


func _draw_progress(viewport_size: Vector2) -> void:
	var total: int = maxi(1, _target_letters.size())
	var spacing := 16.0 * _layout_scale
	var radius := 5.0 * _layout_scale
	var width := float(total - 1) * spacing
	var start_x := viewport_size.x * 0.5 - width * 0.5
	var y := 26.0 * _layout_scale
	for index in range(total):
		var center := Vector2(start_x + float(index) * spacing, y)
		var filled := index < _placed_count
		draw_circle(center + Vector2(0.0, 1.2 * _layout_scale), radius * 1.4, Color(0.15, 0.19, 0.32, 0.14))
		draw_circle(center, radius * 1.22, Color.WHITE)
		draw_circle(center, radius, Color(1.0, 0.72, 0.16) if filled else Color(0.74, 0.82, 0.91))


func _draw_cloud(center: Vector2, scale_value: float) -> void:
	var color := Color(1.0, 1.0, 1.0, 0.74)
	draw_circle(center + Vector2(-24.0, 4.0) * scale_value, 20.0 * scale_value, color)
	draw_circle(center + Vector2(-4.0, -6.0) * scale_value, 25.0 * scale_value, color)
	draw_circle(center + Vector2(24.0, 5.0) * scale_value, 18.0 * scale_value, color)
	draw_rect(Rect2(center + Vector2(-34.0, 3.0) * scale_value, Vector2(68.0, 18.0) * scale_value), color)


func _draw_hill(center: Vector2, radius: float, color: Color) -> void:
	draw_circle(center + Vector2(0.0, radius * 0.72), radius, color)


func _draw_round_rect(rect: Rect2, radius: float, color: Color) -> void:
	var diameter := radius * 2.0
	draw_rect(Rect2(rect.position + Vector2(radius, 0.0), Vector2(maxf(0.0, rect.size.x - diameter), rect.size.y)), color)
	draw_rect(Rect2(rect.position + Vector2(0.0, radius), Vector2(rect.size.x, maxf(0.0, rect.size.y - diameter))), color)
	draw_circle(rect.position + Vector2(radius, radius), radius, color)
	draw_circle(rect.position + Vector2(rect.size.x - radius, radius), radius, color)
	draw_circle(rect.position + Vector2(radius, rect.size.y - radius), radius, color)
	draw_circle(rect.position + Vector2(rect.size.x - radius, rect.size.y - radius), radius, color)


func _animate_idle() -> void:
	for index in range(_blocks.size()):
		var block_data := _blocks[index]
		if bool(block_data["placed"]) or block_data == _dragging_block:
			continue
		var panel := block_data["panel"] as Panel
		var bob := sin(_elapsed * 2.2 + float(index) * 0.9) * 3.0 * _layout_scale
		var start_pos := block_data["start_pos"] as Vector2
		panel.position = Vector2(start_pos.x, start_pos.y + bob)


func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		var touch := event as InputEventScreenTouch
		if touch.pressed:
			_note_child_action()
			_begin_drag(touch.position, touch.index)
		elif touch.index == _active_pointer:
			_note_child_action()
			_end_drag(touch.position)
	elif event is InputEventScreenDrag and (event as InputEventScreenDrag).index == _active_pointer:
		_note_child_action()
		_drag_to((event as InputEventScreenDrag).position)
	elif event is InputEventMouseButton and (event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT:
		var mouse_button := event as InputEventMouseButton
		if mouse_button.pressed:
			_note_child_action()
			_begin_drag(mouse_button.position, 0)
		else:
			_note_child_action()
			_end_drag(mouse_button.position)
	elif event is InputEventMouseMotion and _active_pointer == 0:
		_note_child_action()
		_drag_to((event as InputEventMouseMotion).position)


func _begin_drag(pointer_pos: Vector2, pointer_id: int) -> void:
	if not _dragging_block.is_empty():
		return

	for index in range(_blocks.size() - 1, -1, -1):
		var block_data := _blocks[index]
		if bool(block_data["placed"]):
			continue
		if _block_contains_point(block_data, pointer_pos):
			var panel := block_data["panel"] as Panel
			_dragging_block = block_data
			_active_pointer = pointer_id
			_drag_offset = panel.position - pointer_pos
			panel.z_index = 100
			create_tween().tween_property(panel, "scale", Vector2.ONE * 1.12, 0.08)
			_emit_game_event("letter_drag_started", {
				"roundId": _round_id,
				"blockId": String(block_data["id"]),
				"letter": String(block_data["letter"]),
				"isExtra": bool(block_data["isExtra"]),
			})
			accept_event()
			return


func _drag_to(pointer_pos: Vector2) -> void:
	if _dragging_block.is_empty():
		return
	var panel := _dragging_block["panel"] as Panel
	panel.position = pointer_pos + _drag_offset
	accept_event()


func _end_drag(_pointer_pos: Vector2) -> void:
	if _dragging_block.is_empty():
		return

	var block_data := _dragging_block
	var panel := block_data["panel"] as Panel
	var drop_center := panel.position + panel.size * 0.5
	var slot_index := _closest_available_slot_index(drop_center)
	panel.z_index = 10

	_dragging_block = {}
	_active_pointer = -1

	if slot_index >= 0 and String(_slots[slot_index]["letter"]) == String(block_data["letter"]):
		_place_block(block_data, slot_index)
	else:
		_reject_block(block_data, slot_index)
	accept_event()


func _block_contains_point(block_data: Dictionary, point: Vector2) -> bool:
	var panel := block_data["panel"] as Panel
	var bounds := Rect2(panel.position, panel.size * panel.scale).grow(14.0 * _layout_scale)
	return bounds.has_point(point)


func _closest_available_slot_index(point: Vector2) -> int:
	var closest_index := -1
	var closest_distance := INF
	var snap_radius := _slot_size * SNAP_RADIUS_FACTOR
	for index in range(_slots.size()):
		var slot := _slots[index]
		if not String(slot["occupiedBlockId"]).is_empty():
			continue
		var distance := point.distance_to(slot["pos"] as Vector2)
		if distance <= snap_radius and distance < closest_distance:
			closest_distance = distance
			closest_index = index
	return closest_index


func _place_block(block_data: Dictionary, slot_index: int) -> void:
	_note_child_action()
	block_data["placed"] = true
	block_data["slotIndex"] = slot_index
	_slots[slot_index]["occupiedBlockId"] = String(block_data["id"])
	_placed_count += 1

	var panel := block_data["panel"] as Panel
	var style := block_data["style"] as StyleBoxFlat
	var target_pos := (_slots[slot_index]["pos"] as Vector2) - panel.size * 0.5
	style.border_color = Color(0.74, 1.0, 0.55)

	_play_sound(_success_player)
	_burst_confetti(_slots[slot_index]["pos"] as Vector2, 16)
	_emit_game_event("letter_placed", _progress_payload(block_data, slot_index))

	var snap_tween := create_tween()
	snap_tween.set_trans(Tween.TRANS_BACK)
	snap_tween.set_ease(Tween.EASE_OUT)
	snap_tween.tween_property(panel, "position", target_pos, 0.16)
	snap_tween.parallel().tween_property(panel, "scale", Vector2.ONE * 1.12, 0.16)
	snap_tween.tween_property(panel, "scale", Vector2.ONE, 0.18)

	if _placed_count >= _target_letters.size():
		_complete_round()


func _reject_block(block_data: Dictionary, nearest_slot_index: int) -> void:
	_note_child_action()
	var panel := block_data["panel"] as Panel
	var start_pos := block_data["start_pos"] as Vector2
	_play_sound(_wrong_player)
	if _haptics_enabled:
		Input.vibrate_handheld(90)
	_emit_game_event("letter_rejected", _progress_payload(block_data, nearest_slot_index))

	var color_tween := create_tween()
	panel.modulate = Color(1.0, 0.45, 0.45)
	color_tween.tween_property(panel, "modulate", Color.WHITE, 0.22)

	var tween := create_tween()
	tween.set_trans(Tween.TRANS_SINE)
	tween.set_ease(Tween.EASE_IN_OUT)
	var shake := 10.0 * _layout_scale
	tween.tween_property(panel, "position", panel.position + Vector2(shake, 0.0), 0.035)
	tween.tween_property(panel, "position", panel.position + Vector2(-shake, 0.0), 0.035)
	tween.tween_property(panel, "position", panel.position + Vector2(shake * 0.6, 0.0), 0.035)
	tween.tween_property(panel, "position", start_pos, 0.18)
	tween.parallel().tween_property(panel, "scale", Vector2.ONE, 0.18)


func _complete_round() -> void:
	_play_sound(_complete_player)
	_complete_label.visible = true
	_complete_label.scale = Vector2.ONE * 0.72
	_complete_label.modulate.a = 0.0
	_burst_confetti(size * 0.5, 72)

	var tween := create_tween()
	tween.set_trans(Tween.TRANS_BACK)
	tween.set_ease(Tween.EASE_OUT)
	tween.tween_property(_complete_label, "scale", Vector2.ONE, 0.28)
	tween.parallel().tween_property(_complete_label, "modulate:a", 1.0, 0.2)
	_emit_game_event("game_completed", {
		"roundId": _round_id,
		"targetWord": _target_word,
		"placedCount": _placed_count,
		"totalLetters": _target_letters.size(),
		"assembledWord": _assembled_word(),
	})


func _burst_confetti(origin: Vector2, amount: int) -> void:
	for index in range(amount):
		var bit := ColorRect.new()
		bit.mouse_filter = Control.MOUSE_FILTER_IGNORE
		bit.color = CONFETTI_COLORS[_rng.randi_range(0, CONFETTI_COLORS.size() - 1)]
		bit.size = Vector2.ONE * _rng.randf_range(5.0, 10.0) * _layout_scale
		bit.pivot_offset = bit.size * 0.5
		bit.position = origin - bit.size * 0.5
		_fx_layer.add_child(bit)

		var angle := _rng.randf_range(-PI, PI)
		var distance := _rng.randf_range(48.0, 140.0) * _layout_scale
		var target := origin + Vector2(cos(angle), sin(angle)) * distance
		target.y += _rng.randf_range(18.0, 72.0) * _layout_scale

		var tween := create_tween()
		tween.set_parallel(true)
		tween.tween_property(bit, "position", target, _rng.randf_range(0.42, 0.7))
		tween.tween_property(bit, "rotation", _rng.randf_range(-6.0, 6.0), 0.58)
		tween.tween_property(bit, "modulate:a", 0.0, 0.62).set_delay(0.12)
		tween.finished.connect(bit.queue_free)


func _play_sound(player: AudioStreamPlayer) -> void:
	if _sound_enabled:
		player.play()


func _note_child_action() -> void:
	_idle_seconds = 0.0
	_hide_idle_hint()


func _update_idle_hint() -> void:
	if _dragging_block.size() > 0 or _placed_count >= _target_letters.size():
		return
	if _hint_hand.visible:
		return
	if _idle_seconds < IDLE_HINT_DELAY_SECONDS:
		return

	var block_data := _first_helpful_unplaced_block()
	if block_data.is_empty():
		return

	_show_idle_hint(block_data)


func _first_helpful_unplaced_block() -> Dictionary:
	var candidates: Array[Dictionary] = []
	for block_data in _blocks:
		if bool(block_data["placed"]) or bool(block_data["isExtra"]):
			continue
		if _first_open_slot_for_letter(String(block_data["letter"])) >= 0:
			candidates.append(block_data)
	if candidates.is_empty():
		return {}
	return candidates[_rng.randi_range(0, candidates.size() - 1)]


func _first_open_slot_for_letter(letter: String) -> int:
	for index in range(_slots.size()):
		if String(_slots[index]["letter"]) == letter and String(_slots[index]["occupiedBlockId"]).is_empty():
			return index
	return -1


func _show_idle_hint(block_data: Dictionary) -> void:
	var slot_index := _first_open_slot_for_letter(String(block_data["letter"]))
	if slot_index < 0:
		return

	var start_pos := block_data["start_pos"] as Vector2
	var target_pos := _slots[slot_index]["pos"] as Vector2
	if start_pos == Vector2.ZERO or target_pos == Vector2.ZERO:
		return

	_hint_hand.visible = true
	_hint_hand.modulate.a = 0.0
	_hint_hand.position = start_pos + Vector2(22.0, 18.0) * _layout_scale
	_hint_hand.rotation = -0.18

	var hint_end := start_pos.lerp(target_pos, 0.56) + Vector2(18.0, 16.0) * _layout_scale
	_hint_tween = create_tween()
	_hint_tween.set_loops(3)
	_hint_tween.tween_property(_hint_hand, "modulate:a", 0.95, 0.18)
	_hint_tween.parallel().tween_property(_hint_hand, "scale", Vector2.ONE * ((HINT_VISUAL_SIZE * 1.05 * _layout_scale) / 512.0), 0.18)
	_hint_tween.tween_property(_hint_hand, "position", hint_end, 0.72).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_hint_tween.parallel().tween_property(_hint_hand, "rotation", -0.05, 0.72)
	_hint_tween.tween_property(_hint_hand, "modulate:a", 0.0, 0.22)
	_hint_tween.tween_callback(func() -> void:
		_hint_hand.position = start_pos + Vector2(22.0, 18.0) * _layout_scale
		_hint_hand.rotation = -0.18
	)
	_hint_tween.finished.connect(func() -> void:
		_hint_hand.visible = false
		_idle_seconds = 0.0
	)


func _hide_idle_hint() -> void:
	if _hint_tween != null and _hint_tween.is_valid():
		_hint_tween.kill()
	if _hint_hand != null:
		_hint_hand.visible = false
		_hint_hand.modulate.a = 0.0


func _current_extra_letter_count() -> int:
	var count := 0
	for block_data in _blocks:
		if bool(block_data["isExtra"]):
			count += 1
	return count


func _tray_order() -> Array[String]:
	var order: Array[String] = []
	for block_data in _blocks:
		order.append("%s:%s" % [String(block_data["id"]), String(block_data["letter"])])
	return order


func _available_letters() -> Array[String]:
	var letters: Array[String] = []
	for block_data in _blocks:
		letters.append(String(block_data["letter"]))
	return letters


func _assembled_word() -> String:
	var assembled := ""
	for slot in _slots:
		var block_id := String(slot["occupiedBlockId"])
		if block_id.is_empty():
			assembled += "_"
		else:
			assembled += String(slot["letter"])
	return assembled


func _round_payload() -> Dictionary:
	return {
		"roundId": _round_id,
		"targetWord": _target_word,
		"targetLetters": _target_letters,
		"availableLetters": _available_letters(),
		"trayOrder": _tray_order(),
		"extraLetterCount": _current_extra_letter_count(),
	}


func _progress_payload(block_data: Dictionary, slot_index: int) -> Dictionary:
	var payload := {
		"roundId": _round_id,
		"targetWord": _target_word,
		"blockId": String(block_data["id"]),
		"letter": String(block_data["letter"]),
		"isExtra": bool(block_data["isExtra"]),
		"placedCount": _placed_count,
		"totalLetters": _target_letters.size(),
		"assembledWord": _assembled_word(),
	}
	if slot_index >= 0:
		payload["slotIndex"] = slot_index
		payload["expectedLetter"] = String(_slots[slot_index]["letter"])
	return payload


func _emit_game_event(event_name: String, payload: Dictionary) -> void:
	payload["event"] = event_name
	payload["timestampMs"] = Time.get_ticks_msec()
	game_event.emit(event_name, payload)

	match event_name:
		"round_started":
			round_started.emit(payload)
		"word_configured":
			word_configured.emit(payload)
		"letter_drag_started":
			letter_drag_started.emit(payload)
		"letter_placed":
			letter_placed.emit(payload)
		"letter_rejected":
			letter_rejected.emit(payload)
		"round_reset":
			round_reset.emit(payload)
		"game_completed":
			game_completed.emit(payload)
