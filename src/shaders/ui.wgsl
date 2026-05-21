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

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) localPos: vec2<f32>,
  @location(2) rectSize: vec2<f32>,
  @location(3) style: vec4<f32>,
  @location(4) gradientColor: vec4<f32>,
  @location(5) shadowColor: vec4<f32>,
  @location(6) shadow: vec4<f32>,
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
  let local = rect.rectSize * quad[vid];
  let pixel = rect.rectPos + local;
  let ndcX = (pixel.x / g.canvasSize.x) * 2.0 - 1.0;
  let ndcY = 1.0 - (pixel.y / g.canvasSize.y) * 2.0;

  var out: VertexOut;
  out.position = vec4<f32>(ndcX, ndcY, 0.0, 1.0);
  out.color = rect.rectColor;
  out.localPos = local;
  out.rectSize = rect.rectSize;
  out.style = rect.style;
  out.gradientColor = rect.gradientColor;
  out.shadowColor = rect.shadowColor;
  out.shadow = rect.shadow;
  return out;
}

@fragment
fn fs(in: VertexOut) -> @location(0) vec4<f32> {
  let radius = max(in.style.x, 0.0);
  let softness = max(in.style.y, 0.5);
  let gradientMix = clamp(in.style.z, 0.0, 1.0);

  let halfSize = in.rectSize * 0.5;
  let p = in.localPos - halfSize;
  let q = abs(p) - (halfSize - vec2<f32>(radius));
  let dist = length(max(q, vec2<f32>(0.0))) - radius;
  let alpha = 1.0 - smoothstep(0.0, softness, dist);

  let gradientFactor = in.localPos.y / max(in.rectSize.y, 1.0);
  let baseColor = mix(in.color, in.gradientColor, gradientMix * gradientFactor);

  let shadowOffset = in.shadow.xy;
  let shadowBlur = max(in.shadow.z, 0.0);
  let shadowSpread = in.shadow.w;
  let shadowHalf = halfSize + vec2<f32>(shadowSpread);
  let shadowRadius = max(0.0, radius + shadowSpread);
  let shadowP = p - shadowOffset;
  let shadowQ = abs(shadowP) - (shadowHalf - vec2<f32>(shadowRadius));
  let shadowDist = length(max(shadowQ, vec2<f32>(0.0))) - shadowRadius;
  let shadowAlpha = in.shadowColor.a * (1.0 - smoothstep(0.0, shadowBlur, shadowDist));

  let rectColor = vec4<f32>(baseColor.rgb, baseColor.a * alpha);
  let shadowColor = vec4<f32>(in.shadowColor.rgb, shadowAlpha);
  let outAlpha = rectColor.a + shadowColor.a * (1.0 - rectColor.a);
  let outRgb = (rectColor.rgb * rectColor.a + shadowColor.rgb * shadowColor.a * (1.0 - rectColor.a))
    / max(outAlpha, 0.0001);

  return vec4<f32>(outRgb, outAlpha);
}
