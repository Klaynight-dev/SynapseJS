import { SynapseEngine, Color4 } from "./core";

export async function mountDemo(canvas: HTMLCanvasElement): Promise<void> {
  const engine = await SynapseEngine.create(canvas);
  engine.setContinuousRender(true);
  engine.enableStats(true);
  engine.start();

  const dpr = window.devicePixelRatio || 1;
  const W = engine.getCanvasSize().x;
  const H = engine.getCanvasSize().y;

  const palette: Color4[] = [
    { r: 0.13, g: 0.83, b: 0.93, a: 0.9 },
    { r: 0.60, g: 0.45, b: 0.98, a: 0.9 },
    { r: 0.20, g: 0.90, b: 0.55, a: 0.9 },
    { r: 0.98, g: 0.55, b: 0.20, a: 0.9 },
    { r: 0.97, g: 0.28, b: 0.45, a: 0.9 },
    { r: 0.25, g: 0.65, b: 0.98, a: 0.9 },
  ];

  const hover: Color4 = { r: 1, g: 1, b: 1, a: 0.95 };
  const N = 200;

  interface P { x: number; y: number; vx: number; vy: number; s: number; id: number }
  const ps: P[] = [];

  for (let i = 0; i < N; i++) {
    const s = (6 + Math.random() * 22) * dpr;
    const x = Math.random() * (W - s);
    const y = Math.random() * (H - s);
    const c = palette[i % palette.length];
    const box = engine.createBox({
      position: { x, y }, size: { x: s, y: s },
      color: c, hoverColor: hover,
      radius: s / 4, softness: 1,
      shadowColor: { r: 0, g: 0, b: 0, a: 0.18 },
      shadowOffset: { x: 0, y: 2 * dpr },
      shadowBlur: 6 * dpr, shadowSpread: 0,
    });
    box.onClick(() => box.setColor(palette[Math.floor(Math.random() * palette.length)]));
    ps.push({ x, y, vx: (Math.random() - 0.5) * 1.2 * dpr, vy: (Math.random() - 0.5) * 1.2 * dpr, s, id: box.id });
  }

  function tick(): void {
    for (const p of ps) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x + p.s > W) p.vx *= -1;
      if (p.y < 0 || p.y + p.s > H) p.vy *= -1;
      p.x = Math.max(0, Math.min(W - p.s, p.x));
      p.y = Math.max(0, Math.min(H - p.s, p.y));
      engine.updateBox(p.id, { position: { x: p.x, y: p.y } });
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  const el = document.getElementById("demo-fps");
  if (el) setInterval(() => {
    const s = engine.getFrameStats();
    el.textContent = `${Math.round(s.fps)} FPS · ${s.nodeCount} nodes · ${s.cpuMs.toFixed(1)}ms · ${s.drawCalls} draw call`;
  }, 250);
}
