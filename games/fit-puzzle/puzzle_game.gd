extends Control

signal game_event(event_name: String, payload: Dictionary)
signal round_started(payload: Dictionary)
signal item_drag_started(payload: Dictionary)
signal item_placed(payload: Dictionary)
signal item_rejected(payload: Dictionary)
signal round_reset(payload: Dictionary)
signal game_completed(payload: Dictionary)

const ITEM_DEFS := [
	{"id": "star", "path": "res://assets/items/star.png"},
	{"id": "cake", "path": "res://assets/items/cake.png"},
	{"id": "basket", "path": "res://assets/items/basket.png"},
	{"id": "toy_car", "path": "res://assets/items/toy_car.png"},
	{"id": "teddy_bear", "path": "res://assets/items/teddy_bear.png"},
	{"id": "beach_ball", "path": "res://assets/items/beach_ball.png"},
	{"id": "apple", "path": "res://assets/items/apple.png"},
	{"id": "rocket", "path": "res://assets/items/rocket.png"},
	{"id": "umbrella", "path": "res://assets/items/umbrella.png"},
	{"id": "sun", "path": "res://assets/items/sun.png"},
]

const ROUND_ITEM_COUNT := 3

const TARGET_SLOTS := [
	Vector2(0.24, 0.27),
	Vector2(0.76, 0.27),
	Vector2(0.50, 0.52),
]

const START_SLOTS := [
	Vector2(0.22, 0.84),
	Vector2(0.50, 0.84),
	Vector2(0.78, 0.84),
]

const ITEM_VISUAL_SIZE := 78.0
const TARGET_PAD_SIZE := 96.0
const IDLE_HINT_DELAY_SECONDS := 5.0
const HINT_VISUAL_SIZE := 82.0

const CONFETTI_COLORS := [
	Color(1.0, 0.23, 0.36),
	Color(1.0, 0.74, 0.16),
	Color(0.18, 0.72, 1.0),
	Color(0.41, 0.86, 0.35),
	Color(0.74, 0.36, 1.0),
]

const TARGET_COLORS := [
	Color(1.0, 0.78, 0.34, 0.52),
	Color(1.0, 0.48, 0.67, 0.46),
	Color(0.44, 0.86, 1.0, 0.48),
	Color(0.65, 0.91, 0.45, 0.46),
	Color(0.75, 0.54, 1.0, 0.44),
]

var _holes_layer: Node2D
var _pieces_layer: Node2D
var _fx_layer: Control
var _complete_label: Label
var _hint_hand: Sprite2D
var _success_player: AudioStreamPlayer
var _wrong_player: AudioStreamPlayer
var _complete_player: AudioStreamPlayer
var _hint_tween: Tween

var _pieces: Array[Dictionary] = []
var _dragging_piece: Dictionary = {}
var _active_pointer := -1
var _drag_offset := Vector2.ZERO
var _layout_scale := 1.0
var _elapsed := 0.0
var _idle_seconds := 0.0
var _placed_count := 0
var _round_id := "default"
var _sound_enabled := true
var _haptics_enabled := true
var _last_round_item_ids: Array[String] = []
var _last_start_order: Array[String] = []
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	_rng.randomize()
	_build_nodes()
	_select_round_items()
	_shuffle_start_slots()
	resized.connect(_layout_game)
	_layout_game()
	var app_controller := get_node_or_null("/root/AppController")
	if app_controller != null and app_controller.has_method("register_game"):
		app_controller.call("register_game", self)
	_emit_game_event("round_started", {
		"roundId": _round_id,
		"catalogItemIds": _catalog_item_ids(),
		"itemIds": _item_ids(),
		"startOrder": _start_order(),
	})


func reset_round(round_id: String = "default") -> void:
	_round_id = round_id
	_placed_count = 0
	_dragging_piece = {}
	_active_pointer = -1
	_idle_seconds = 0.0
	_hide_idle_hint()
	_complete_label.visible = false
	_complete_label.modulate.a = 0.0

	for child in _fx_layer.get_children():
		if child == _hint_hand:
			continue
		child.queue_free()

	for piece_data in _pieces:
		piece_data["placed"] = false
		var piece := piece_data["piece"] as Sprite2D
		piece.modulate = Color.WHITE
		piece.rotation = 0.0
		piece.z_index = 10

	_select_round_items()
	_shuffle_start_slots()
	_layout_game()
	_emit_game_event("round_reset", {
		"roundId": _round_id,
		"catalogItemIds": _catalog_item_ids(),
		"itemIds": _item_ids(),
		"startOrder": _start_order(),
	})


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
	var viewport_size := size
	_draw_background(viewport_size)
	_draw_target_pads()
	_draw_progress(viewport_size)


func _draw_background(viewport_size: Vector2) -> void:
	draw_rect(Rect2(Vector2.ZERO, viewport_size), Color(1.0, 0.97, 0.86))
	draw_rect(Rect2(Vector2(0.0, 0.0), Vector2(viewport_size.x, viewport_size.y * 0.36)), Color(0.72, 0.91, 1.0))
	draw_rect(Rect2(Vector2(0.0, viewport_size.y * 0.36), Vector2(viewport_size.x, viewport_size.y * 0.32)), Color(1.0, 0.94, 0.75))
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

	_draw_cloud(Vector2(viewport_size.x * 0.18, viewport_size.y * 0.10), 0.92 * _layout_scale)
	_draw_cloud(Vector2(viewport_size.x * 0.82, viewport_size.y * 0.12), 0.72 * _layout_scale)
	_draw_hill(Vector2(viewport_size.x * 0.22, viewport_size.y * 0.67), viewport_size.x * 0.62, Color(0.62, 0.91, 0.45, 0.82))
	_draw_hill(Vector2(viewport_size.x * 0.77, viewport_size.y * 0.68), viewport_size.x * 0.58, Color(0.38, 0.82, 0.55, 0.72))

	var tray_rect := Rect2(
		Vector2(14.0 * _layout_scale, viewport_size.y * 0.705),
		Vector2(viewport_size.x - 28.0 * _layout_scale, viewport_size.y * 0.265)
	)
	_draw_round_rect(tray_rect.grow(5.0 * _layout_scale), 28.0 * _layout_scale, Color(0.24, 0.58, 0.92, 0.18))
	_draw_round_rect(tray_rect, 24.0 * _layout_scale, Color(1.0, 1.0, 1.0, 0.68))
	draw_line(Vector2(24.0 * _layout_scale, viewport_size.y * 0.705), Vector2(viewport_size.x - 24.0 * _layout_scale, viewport_size.y * 0.705), Color(1.0, 0.72, 0.26, 0.5), 4.0 * _layout_scale)


func _draw_target_pads() -> void:
	for index in range(_pieces.size()):
		var piece_data := _pieces[index]
		if not bool(piece_data["active"]):
			continue
		var target_pos := piece_data["target_pos"] as Vector2
		if target_pos == Vector2.ZERO:
			continue

		var pad_size := TARGET_PAD_SIZE * _layout_scale
		var pad_rect := Rect2(target_pos - Vector2.ONE * pad_size * 0.5, Vector2.ONE * pad_size)
		var color: Color = TARGET_COLORS[index % TARGET_COLORS.size()]
		_draw_round_rect(pad_rect.grow(4.0 * _layout_scale), 24.0 * _layout_scale, Color(1.0, 1.0, 1.0, 0.58))
		_draw_round_rect(pad_rect, 20.0 * _layout_scale, color)
		draw_circle(target_pos + Vector2(0.0, 2.0 * _layout_scale), 8.0 * _layout_scale, Color(1.0, 1.0, 1.0, 0.32))


func _draw_progress(viewport_size: Vector2) -> void:
	var total: int = maxi(1, _active_piece_count())
	var spacing := 18.0 * _layout_scale
	var radius := 5.2 * _layout_scale
	var width := float(total - 1) * spacing
	var start_x := viewport_size.x * 0.5 - width * 0.5
	var y := 28.0 * _layout_scale
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


func _build_nodes() -> void:
	_holes_layer = Node2D.new()
	_holes_layer.name = "ShapeHoles"
	add_child(_holes_layer)

	_pieces_layer = Node2D.new()
	_pieces_layer.name = "PuzzlePieces"
	add_child(_pieces_layer)

	_fx_layer = Control.new()
	_fx_layer.name = "CelebrationLayer"
	_fx_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fx_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_fx_layer)

	_complete_label = Label.new()
	_complete_label.text = "Muito bem!"
	_complete_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_complete_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_complete_label.add_theme_font_size_override("font_size", 42)
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

	for item in ITEM_DEFS:
		var texture := load(String(item["path"])) as Texture2D
		if texture == null:
			push_warning("Missing puzzle texture: " + String(item["path"]))
			continue
		var hole_texture := load("res://assets/holes/%s_hole.png" % String(item["id"])) as Texture2D
		if hole_texture == null:
			hole_texture = texture

		var shadow := Sprite2D.new()
		shadow.name = String(item["id"]) + "_hole_shadow"
		shadow.texture = hole_texture
		shadow.centered = true
		shadow.modulate = Color(0.04, 0.07, 0.13, 0.22)
		_holes_layer.add_child(shadow)

		var hole := Sprite2D.new()
		hole.name = String(item["id"]) + "_hole"
		hole.texture = hole_texture
		hole.centered = true
		hole.modulate = Color.WHITE
		_holes_layer.add_child(hole)

		var piece := Sprite2D.new()
		piece.name = String(item["id"]) + "_piece"
		piece.texture = texture
		piece.centered = true
		piece.z_index = 10
		_pieces_layer.add_child(piece)

		_pieces.append({
			"id": String(item["id"]),
			"target_normalized": Vector2.ZERO,
			"start_normalized": Vector2.ZERO,
			"target_pos": Vector2.ZERO,
			"start_pos": Vector2.ZERO,
			"base_scale": 1.0,
			"active": false,
			"placed": false,
			"piece": piece,
			"hole": hole,
			"shadow": shadow,
			"texture": texture,
			"hole_texture": hole_texture,
		})


func _new_audio_player(path: String) -> AudioStreamPlayer:
	var player := AudioStreamPlayer.new()
	player.stream = load(path) as AudioStream
	player.bus = "Master"
	add_child(player)
	return player


func _select_round_items() -> void:
	var indices: Array[int] = []
	for index in range(_pieces.size()):
		indices.append(index)
		_set_piece_active(_pieces[index], false)

	_shuffle_ints(indices)
	var count: int = mini(ROUND_ITEM_COUNT, _pieces.size())
	var selected_indices: Array[int] = indices.slice(0, count)
	var selected_ids: Array[String] = _sorted_ids_for_indices(selected_indices)

	if selected_ids == _last_round_item_ids and _pieces.size() > count:
		var replacement_index: int = indices[count]
		selected_indices[count - 1] = replacement_index
		selected_ids = _sorted_ids_for_indices(selected_indices)

	var target_slots: Array[Vector2] = []
	for slot in TARGET_SLOTS:
		target_slots.append(slot)
	_shuffle_vector2s(target_slots)

	for index in range(selected_indices.size()):
		var piece_data := _pieces[selected_indices[index]]
		piece_data["target_normalized"] = target_slots[index % target_slots.size()]
		piece_data["placed"] = false
		_set_piece_active(piece_data, true)

	_last_round_item_ids = selected_ids
	_last_start_order = []


func _set_piece_active(piece_data: Dictionary, active: bool) -> void:
	piece_data["active"] = active
	piece_data["target_pos"] = Vector2.ZERO
	piece_data["start_pos"] = Vector2.ZERO
	piece_data["start_normalized"] = Vector2.ZERO

	var piece := piece_data["piece"] as Sprite2D
	var hole := piece_data["hole"] as Sprite2D
	var shadow := piece_data["shadow"] as Sprite2D
	piece.visible = active
	hole.visible = active
	shadow.visible = active
	piece.modulate = Color.WHITE
	piece.rotation = 0.0
	piece.z_index = 10


func _shuffle_ints(values: Array[int]) -> void:
	for index in range(values.size() - 1, 0, -1):
		var swap_index := _rng.randi_range(0, index)
		var current_value: int = values[index]
		values[index] = values[swap_index]
		values[swap_index] = current_value


func _shuffle_vector2s(values: Array[Vector2]) -> void:
	for index in range(values.size() - 1, 0, -1):
		var swap_index := _rng.randi_range(0, index)
		var current_value: Vector2 = values[index]
		values[index] = values[swap_index]
		values[swap_index] = current_value


func _sorted_ids_for_indices(indices: Array[int]) -> Array[String]:
	var ids: Array[String] = []
	for index in indices:
		ids.append(String(_pieces[index]["id"]))
	ids.sort()
	return ids


func _shuffle_start_slots() -> void:
	var slots: Array[Vector2] = []
	for slot in START_SLOTS:
		slots.append(slot)

	_shuffle_vector2s(slots)

	var next_order := _order_for_slots(slots)
	if next_order == _last_start_order and slots.size() > 1:
		var first_slot: Vector2 = slots.pop_front()
		slots.append(first_slot)
		next_order = _order_for_slots(slots)

	var active_pieces: Array[Dictionary] = _active_pieces()
	for index in range(active_pieces.size()):
		active_pieces[index]["start_normalized"] = slots[index]
	_last_start_order = next_order


func _layout_game() -> void:
	if size.x <= 0.0 or size.y <= 0.0:
		return

	_layout_scale = min(size.x / 390.0, size.y / 844.0)
	_complete_label.position = Vector2(0.0, 18.0 * _layout_scale)
	_complete_label.size = Vector2(size.x, 62.0 * _layout_scale)
	_complete_label.add_theme_font_size_override("font_size", int(42.0 * _layout_scale))

	for piece_data in _pieces:
		if not bool(piece_data["active"]):
			continue

		var target_pos := Vector2(
			float((piece_data["target_normalized"] as Vector2).x) * size.x,
			float((piece_data["target_normalized"] as Vector2).y) * size.y
		)
		var start_pos := Vector2(
			float((piece_data["start_normalized"] as Vector2).x) * size.x,
			float((piece_data["start_normalized"] as Vector2).y) * size.y
		)
		var texture_size := (piece_data["texture"] as Texture2D).get_size()
		var max_dimension: float = maxf(texture_size.x, texture_size.y)
		var base_scale: float = (ITEM_VISUAL_SIZE * _layout_scale) / max_dimension

		piece_data["target_pos"] = target_pos
		piece_data["start_pos"] = start_pos
		piece_data["base_scale"] = base_scale

		var hole := piece_data["hole"] as Sprite2D
		var shadow := piece_data["shadow"] as Sprite2D
		var piece := piece_data["piece"] as Sprite2D
		hole.position = target_pos
		hole.scale = Vector2.ONE * base_scale * 1.06
		shadow.position = target_pos + Vector2(0.0, 3.0 * _layout_scale)
		shadow.scale = Vector2.ONE * base_scale * 1.14

		if bool(piece_data["placed"]):
			piece.position = target_pos
			piece.scale = Vector2.ONE * base_scale
		elif piece_data != _dragging_piece:
			piece.position = start_pos
			piece.scale = Vector2.ONE * base_scale

	if _hint_hand != null:
		_hint_hand.scale = Vector2.ONE * ((HINT_VISUAL_SIZE * _layout_scale) / 512.0)


func _animate_idle() -> void:
	for index in range(_pieces.size()):
		var piece_data := _pieces[index]
		if not bool(piece_data["active"]):
			continue

		var hole := piece_data["hole"] as Sprite2D
		var shadow := piece_data["shadow"] as Sprite2D
		var pulse := 1.0 + sin(_elapsed * 2.6 + float(index)) * 0.025
		hole.scale = Vector2.ONE * float(piece_data["base_scale"]) * 1.06 * pulse
		shadow.scale = Vector2.ONE * float(piece_data["base_scale"]) * 1.14 * pulse

		if bool(piece_data["placed"]) or piece_data == _dragging_piece:
			continue
		var piece := piece_data["piece"] as Sprite2D
		var bob := sin(_elapsed * 2.2 + float(index) * 0.9) * 3.0 * _layout_scale
		var start_pos := piece_data["start_pos"] as Vector2
		piece.position = Vector2(start_pos.x, start_pos.y + bob)


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
	if not _dragging_piece.is_empty():
		return

	for index in range(_pieces.size() - 1, -1, -1):
		var piece_data := _pieces[index]
		if not bool(piece_data["active"]) or bool(piece_data["placed"]):
			continue
		if _piece_contains_point(piece_data, pointer_pos):
			var piece := piece_data["piece"] as Sprite2D
			_dragging_piece = piece_data
			_active_pointer = pointer_id
			_drag_offset = piece.position - pointer_pos
			piece.z_index = 100
			piece.rotation = 0.0
			create_tween().tween_property(piece, "scale", Vector2.ONE * float(piece_data["base_scale"]) * 1.14, 0.08)
			_emit_game_event("item_drag_started", {
				"roundId": _round_id,
				"itemId": String(piece_data["id"]),
			})
			accept_event()
			return


func _drag_to(pointer_pos: Vector2) -> void:
	if _dragging_piece.is_empty():
		return
	var piece := _dragging_piece["piece"] as Sprite2D
	piece.position = pointer_pos + _drag_offset
	accept_event()


func _end_drag(pointer_pos: Vector2) -> void:
	if _dragging_piece.is_empty():
		return

	var piece_data := _dragging_piece
	var piece := piece_data["piece"] as Sprite2D
	var target_pos := piece_data["target_pos"] as Vector2
	var snap_radius := 56.0 * _layout_scale
	piece.z_index = 10

	_dragging_piece = {}
	_active_pointer = -1

	if piece.position.distance_to(target_pos) <= snap_radius:
		_place_piece(piece_data)
	else:
		_reject_piece(piece_data)
	accept_event()


func _piece_contains_point(piece_data: Dictionary, point: Vector2) -> bool:
	var piece := piece_data["piece"] as Sprite2D
	var texture_size := (piece_data["texture"] as Texture2D).get_size() * piece.scale
	var bounds := Rect2(piece.position - texture_size * 0.5, texture_size).grow(18.0 * _layout_scale)
	return bounds.has_point(point)


func _place_piece(piece_data: Dictionary) -> void:
	_note_child_action()
	piece_data["placed"] = true
	_placed_count += 1

	var piece := piece_data["piece"] as Sprite2D
	var hole := piece_data["hole"] as Sprite2D
	var target_pos := piece_data["target_pos"] as Vector2
	piece.modulate = Color.WHITE

	_play_sound(_success_player)
	_burst_confetti(target_pos, 18)
	_emit_game_event("item_placed", _progress_payload(piece_data))

	var snap_tween := create_tween()
	snap_tween.set_trans(Tween.TRANS_BACK)
	snap_tween.set_ease(Tween.EASE_OUT)
	snap_tween.tween_property(piece, "position", target_pos, 0.16)
	snap_tween.parallel().tween_property(piece, "scale", Vector2.ONE * float(piece_data["base_scale"]) * 1.22, 0.16)
	snap_tween.tween_property(piece, "scale", Vector2.ONE * float(piece_data["base_scale"]), 0.18)

	var hole_tween := create_tween()
	hole.modulate = Color(0.55, 1.0, 0.55, 1.0)
	hole_tween.tween_property(hole, "modulate", Color(1.0, 1.0, 1.0, 0.42), 0.35)

	if _placed_count >= _active_piece_count():
		_complete_round()


func _reject_piece(piece_data: Dictionary) -> void:
	_note_child_action()
	var piece := piece_data["piece"] as Sprite2D
	var start_pos := piece_data["start_pos"] as Vector2
	_play_sound(_wrong_player)
	if _haptics_enabled:
		Input.vibrate_handheld(90)
	_emit_game_event("item_rejected", _progress_payload(piece_data))

	var color_tween := create_tween()
	piece.modulate = Color(1.0, 0.22, 0.22)
	color_tween.tween_property(piece, "modulate", Color.WHITE, 0.22)

	var tween := create_tween()
	tween.set_trans(Tween.TRANS_SINE)
	tween.set_ease(Tween.EASE_IN_OUT)
	var shake := 10.0 * _layout_scale
	tween.tween_property(piece, "position", piece.position + Vector2(shake, 0.0), 0.035)
	tween.tween_property(piece, "position", piece.position + Vector2(-shake, 0.0), 0.035)
	tween.tween_property(piece, "position", piece.position + Vector2(shake * 0.6, 0.0), 0.035)
	tween.tween_property(piece, "position", start_pos, 0.18)
	tween.parallel().tween_property(piece, "scale", Vector2.ONE * float(piece_data["base_scale"]), 0.18)


func _complete_round() -> void:
	_play_sound(_complete_player)
	_complete_label.visible = true
	_complete_label.scale = Vector2.ONE * 0.72
	_complete_label.modulate.a = 0.0
	_burst_confetti(size * 0.5, 70)

	var tween := create_tween()
	tween.set_trans(Tween.TRANS_BACK)
	tween.set_ease(Tween.EASE_OUT)
	tween.tween_property(_complete_label, "scale", Vector2.ONE, 0.28)
	tween.parallel().tween_property(_complete_label, "modulate:a", 1.0, 0.2)
	_emit_game_event("game_completed", {
		"roundId": _round_id,
		"placedCount": _placed_count,
		"totalItems": _active_piece_count(),
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
	if _dragging_piece.size() > 0 or _placed_count >= _active_piece_count():
		return
	if _hint_hand.visible:
		return
	if _idle_seconds < IDLE_HINT_DELAY_SECONDS:
		return

	var piece_data := _first_unplaced_active_piece()
	if piece_data.is_empty():
		return

	_show_idle_hint(piece_data)


func _first_unplaced_active_piece() -> Dictionary:
	var candidates: Array[Dictionary] = []
	for piece_data in _active_pieces():
		if not bool(piece_data["placed"]):
			candidates.append(piece_data)
	if candidates.is_empty():
		return {}
	return candidates[_rng.randi_range(0, candidates.size() - 1)]


func _show_idle_hint(piece_data: Dictionary) -> void:
	var start_pos := piece_data["start_pos"] as Vector2
	var target_pos := piece_data["target_pos"] as Vector2
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


func _item_ids() -> Array[String]:
	var ids: Array[String] = []
	for piece_data in _pieces:
		if bool(piece_data["active"]):
			ids.append(String(piece_data["id"]))
	return ids


func _catalog_item_ids() -> Array[String]:
	var ids: Array[String] = []
	for piece_data in _pieces:
		ids.append(String(piece_data["id"]))
	return ids


func _active_pieces() -> Array[Dictionary]:
	var active_pieces: Array[Dictionary] = []
	for piece_data in _pieces:
		if bool(piece_data["active"]):
			active_pieces.append(piece_data)
	return active_pieces


func _active_piece_count() -> int:
	return _active_pieces().size()


func _start_order() -> Array[String]:
	var slots: Array[Vector2] = []
	for piece_data in _active_pieces():
		slots.append(piece_data["start_normalized"] as Vector2)
	return _order_for_slots(slots)


func _order_for_slots(slots: Array[Vector2]) -> Array[String]:
	var ordered_ids: Array[String] = []
	var active_pieces := _active_pieces()
	for tray_slot in START_SLOTS:
		for index in range(mini(slots.size(), active_pieces.size())):
			if slots[index] == tray_slot:
				ordered_ids.append(String(active_pieces[index]["id"]))
				break
	return ordered_ids


func _progress_payload(piece_data: Dictionary) -> Dictionary:
	return {
		"roundId": _round_id,
		"itemId": String(piece_data["id"]),
		"placedCount": _placed_count,
		"totalItems": _active_piece_count(),
	}


func _emit_game_event(event_name: String, payload: Dictionary) -> void:
	payload["event"] = event_name
	payload["timestampMs"] = Time.get_ticks_msec()
	game_event.emit(event_name, payload)

	match event_name:
		"round_started":
			round_started.emit(payload)
		"item_drag_started":
			item_drag_started.emit(payload)
		"item_placed":
			item_placed.emit(payload)
		"item_rejected":
			item_rejected.emit(payload)
		"round_reset":
			round_reset.emit(payload)
		"game_completed":
			game_completed.emit(payload)
