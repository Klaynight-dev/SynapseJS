struct Globals {
  canvasSize: vec2<f32>,
  rectCount: f32,
  _pad0: f32,
};

struct RectInstance {
  rectPos: vec2<f32>,
  rectSize: vec2<f32>,
  rectColor: vec4<f32>,
};

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
};

@group(0) @binding(0)
var<uniform> g: Globals;

@group(0) @binding(1)
var<storage, read> rects: array<RectInstance>;

@vertex
fn vs(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VertexOut {
  let quad = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(1.0, 1.0)
  );

  let rect = rects[iid];
  let pixel = rect.rectPos + (rect.rectSize * quad[vid]);
  let ndcX = (pixel.x / g.canvasSize.x) * 2.0 - 1.0;
  let ndcY = 1.0 - (pixel.y / g.canvasSize.y) * 2.0;

  var out: VertexOut;
  out.position = vec4<f32>(ndcX, ndcY, 0.0, 1.0);
  out.color = rect.rectColor;
  return out;
}

@fragment
fn fs(in: VertexOut) -> @location(0) vec4<f32> {
  return in.color;
}
