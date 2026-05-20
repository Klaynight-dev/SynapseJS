import { Color4, SynapseBox, SynapseEngine, Vec2 } from "../synapse-core";
import { clamp, createOverlay, readBenchConfig, setPageBackground } from "./common";
import { runDomBench } from "./dom-bench";

function formatStats(
  label: string,
  rects: number,
  updateMs: number,
  frameMs: number,
  fps: number,
  cpuMs: number,
  drawCalls: number,
  nodeCount: number,
  canvasSize: Vec2
): string {
  return [
    "Synapse Bench",
    `Mode: ${label}`,
    `Rectangles: ${rects}`,
    `Draw calls: ${drawCalls}`,
    `Nodes: ${nodeCount}`,
    `FPS: ${fps.toFixed(1)}`,
    `Frame time: ${frameMs.toFixed(2)} ms`,
    `CPU render: ${cpuMs.toFixed(2)} ms`,
    `Update loop: ${updateMs.toFixed(2)} ms`,
    `Canvas: ${Math.round(canvasSize.x)}x${Math.round(canvasSize.y)} px`,
    "Params: ?rects=5000&size=10&speed=0.9&gpu=1",
  ].join("\n");
}

async function runSynapseBench(): Promise<void> {
  const config = readBenchConfig({ defaultGpu: true, allowGpuParam: true });

  if (!navigator.gpu) {
    await runDomBench({
      label: "DOM (fallback - no WebGPU)",
      config: { ...config, gpu: false },
    });
    return;
  }

  setPageBackground("#0b0b0f");

  const canvas = document.createElement("canvas");
  canvas.id = "synapse-bench";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.display = "block";
  canvas.style.background = "#0b0b0f";

  document.body.appendChild(canvas);

  const overlay = createOverlay();
  document.body.appendChild(overlay);

  let engine: SynapseEngine;
  try {
    engine = await SynapseEngine.create(canvas);
  } catch (error) {
    console.error("Synapse failed to initialize:", error);
    canvas.remove();
    overlay.remove();
    await runDomBench({
      label: "DOM (fallback - WebGPU init failed)",
      config: { ...config, gpu: false },
    });
    return;
  }

  engine.enableStats(true);
  engine.start();

  const dpr = window.devicePixelRatio || 1;
  const sizePx = config.size * dpr;
  const speedPx = config.speed * dpr;

  const size: Vec2 = { x: sizePx, y: sizePx };
  const palette: Color4[] = [
    { r: 0.2, g: 0.6, b: 0.95, a: 1.0 },
    { r: 0.95, g: 0.45, b: 0.2, a: 1.0 },
    { r: 0.2, g: 0.9, b: 0.55, a: 1.0 },
    { r: 0.95, g: 0.9, b: 0.2, a: 1.0 },
  ];

  const boxes: SynapseBox[] = [];
  const positions: Vec2[] = [];
  const velocities: Vec2[] = [];

  const initialBounds = engine.getCanvasSize();
  const maxInitialX = Math.max(0, initialBounds.x - sizePx);
  const maxInitialY = Math.max(0, initialBounds.y - sizePx);

  for (let i = 0; i < config.rects; i += 1) {
    const position: Vec2 = {
      x: Math.random() * maxInitialX,
      y: Math.random() * maxInitialY,
    };
    const velocity: Vec2 = {
      x: (Math.random() * 2 - 1) * speedPx,
      y: (Math.random() * 2 - 1) * speedPx,
    };

    const color = palette[i % palette.length];
    const box = engine.createBox({
      position,
      size,
      color,
    });

    boxes.push(box);
    positions.push(position);
    velocities.push(velocity);
  }

  const gpuEnabled = config.gpu && engine.enableGpuSimulation(true, velocities);
  if (!gpuEnabled && config.gpu) {
    console.warn("GPU simulation unavailable; using CPU updates.");
  }

  let updateMs = 0;
  let lastOverlayUpdate = 0;

  const tick = (): void => {
    const updateStart = performance.now();
    const bounds = engine.getCanvasSize();
    const maxX = Math.max(0, bounds.x - sizePx);
    const maxY = Math.max(0, bounds.y - sizePx);

    if (!gpuEnabled) {
      for (let i = 0; i < boxes.length; i += 1) {
        const position = positions[i];
        const velocity = velocities[i];

        position.x += velocity.x;
        position.y += velocity.y;

        if (position.x <= 0 || position.x >= maxX) {
          velocity.x *= -1;
          position.x = clamp(position.x, 0, maxX);
        }

        if (position.y <= 0 || position.y >= maxY) {
          velocity.y *= -1;
          position.y = clamp(position.y, 0, maxY);
        }

        boxes[i].setPosition(position);
      }
    }

    updateMs = performance.now() - updateStart;

    const now = performance.now();
    if (now - lastOverlayUpdate > 120) {
      const stats = engine.getFrameStats();
      const label = gpuEnabled
        ? "Synapse (WebGPU + GPU sim)"
        : "Synapse (WebGPU CPU)";
      overlay.textContent = formatStats(
        label,
        config.rects,
        updateMs,
        stats.frameMs,
        stats.fps,
        stats.cpuMs,
        stats.drawCalls,
        stats.nodeCount,
        bounds
      );
      lastOverlayUpdate = now;
    }

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

runSynapseBench().catch((error) => {
  console.error("Synapse benchmark failed:", error);
});
