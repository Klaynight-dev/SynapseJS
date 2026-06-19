struct Globals {
  canvasSize: vec2<f32>,
  rectCount: f32,
  _pad0: f32,
};

struct TextGlyph {
  position: vec2<f32>,
  size: vec2<f32>,
  uvOffset: vec2<f32>,
  uvSize: vec2<f32>,
  color: vec4<f32>,
};

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) color: vec4<f32>,
};

@group(0) @binding(0)
var<uniform> g: Globals;

@group(0) @binding(1)
var<storage, read> glyphs: array<TextGlyph>;

@group(0) @binding(2)
var fontTexture: texture_2d<f32>;

@group(0) @binding(3)
var fontSampler: sampler;

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

  let glyph = glyphs[iid];
  let local = glyph.size * quad[vid];
  let pixel = glyph.position + local;
  let ndcX = (pixel.x / g.canvasSize.x) * 2.0 - 1.0;
  let ndcY = 1.0 - (pixel.y / g.canvasSize.y) * 2.0;

  var out: VertexOut;
  out.position = vec4<f32>(ndcX, ndcY, 0.0, 1.0);
  out.uv = glyph.uvOffset + glyph.uvSize * quad[vid];
  out.color = glyph.color;
  return out;
}

@fragment
fn fs(in: VertexOut) -> @location(0) vec4<f32> {
  let sdfSample = textureSample(fontTexture, fontSampler, in.uv).r;

  let edgeCenter = 0.5;
  let smoothWidth = 0.1;
  let alpha = smoothstep(edgeCenter - smoothWidth, edgeCenter + smoothWidth, sdfSample);

  return vec4<f32>(in.color.rgb, in.color.a * alpha);
}
