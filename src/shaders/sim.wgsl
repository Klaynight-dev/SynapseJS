struct Globals {
  canvasSize: vec2<f32>,
  rectCount: f32,
  _pad0: f32,
};

struct RectInstance {
  rectPos: vec2<f32>,
  rectSize: vec2<f32>,
  rectColor: vec4<f32>,
  style: vec4<f32>,
  gradientColor: vec4<f32>,
  shadowColor: vec4<f32>,
  shadow: vec4<f32>,
};

@group(0) @binding(0)
var<uniform> g: Globals;

@group(0) @binding(1)
var<storage, read_write> rects: array<RectInstance>;

@group(0) @binding(2)
var<storage, read_write> velocities: array<vec2<f32>>;

@compute @workgroup_size(256)
fn cs_update(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x;
  let count = u32(g.rectCount);
  if (index >= count) {
    return;
  }

  var rect = rects[index];
  var velocity = velocities[index];
  var nextPos = rect.rectPos + velocity;

  let maxX = max(0.0, g.canvasSize.x - rect.rectSize.x);
  let maxY = max(0.0, g.canvasSize.y - rect.rectSize.y);

  if (nextPos.x <= 0.0 || nextPos.x >= maxX) {
    velocity.x = -velocity.x;
    nextPos.x = clamp(nextPos.x, 0.0, maxX);
  }

  if (nextPos.y <= 0.0 || nextPos.y >= maxY) {
    velocity.y = -velocity.y;
    nextPos.y = clamp(nextPos.y, 0.0, maxY);
  }

  rect.rectPos = nextPos;
  rects[index] = rect;
  velocities[index] = velocity;
}
