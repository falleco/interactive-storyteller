extends MeshInstance3D

@export var move_speed := 2.6
@export var screen_bounds := Vector2(1.65, 1.15)

var _rng := RandomNumberGenerator.new()
var _material := StandardMaterial3D.new()


func _ready() -> void:
	_rng.randomize()
	_material.albedo_color = Color(0.2, 0.55, 1.0)
	set_surface_override_material(0, _material)


func _process(delta: float) -> void:
	var direction := Vector3.ZERO
	direction.x = Input.get_axis("ui_left", "ui_right")
	direction.y = Input.get_axis("ui_down", "ui_up")

	if direction.length_squared() > 1.0:
		direction = direction.normalized()

	position += direction * move_speed * delta
	position.x = clampf(position.x, -screen_bounds.x, screen_bounds.x)
	position.y = clampf(position.y, -screen_bounds.y, screen_bounds.y)

	if Input.is_action_just_pressed("ui_accept"):
		_cycle_random_color()


func _cycle_random_color() -> void:
	_material.albedo_color = Color.from_hsv(_rng.randf(), 0.72, 1.0)
