extends Node

signal game_event(event_name: String, payload: Dictionary)

var _game: Node


func register_game(game: Node) -> void:
	var callback := Callable(self, "_on_game_event")
	if _game != null and is_instance_valid(_game) and _game.is_connected("game_event", callback):
		_game.disconnect("game_event", callback)

	_game = game
	if _game.has_signal("game_event") and not _game.is_connected("game_event", callback):
		_game.connect("game_event", callback)


func reset_round(round_id: String = "default") -> bool:
	if not _has_game_method("reset_round"):
		return false

	_game.call("reset_round", round_id)
	return true


func configure_palette(round_id: String = "default", color_hexes: Array = [], pattern_ids: Array = []) -> bool:
	if not _has_game_method("configure_palette"):
		return false

	_game.call("configure_palette", round_id, color_hexes, pattern_ids)
	return true


func set_selected_color(color_hex: String) -> bool:
	if not _has_game_method("set_selected_color"):
		return false

	return bool(_game.call("set_selected_color", color_hex))


func set_selected_pattern(pattern_id: String) -> bool:
	if not _has_game_method("set_selected_pattern"):
		return false

	return bool(_game.call("set_selected_pattern", pattern_id))

func set_feedback_enabled(sound_enabled: bool, haptics_enabled: bool) -> bool:
	if not _has_game_method("set_feedback_enabled"):
		return false

	_game.call("set_feedback_enabled", sound_enabled, haptics_enabled)
	return true


func _has_game_method(method_name: StringName) -> bool:
	return _game != null and is_instance_valid(_game) and _game.has_method(method_name)


func _on_game_event(event_name: String, payload: Dictionary) -> void:
	game_event.emit(event_name, payload)
