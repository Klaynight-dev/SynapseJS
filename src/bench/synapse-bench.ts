import { Color4, SynapseBox, SynapseEngine, Vec2 } from "../core";
import {
  BenchConfig,
  BenchHandle,
  BenchSample,
  clamp,
  createOverlay,
  readBenchConfig,
  setPageBackground,
} from "./common";
import { createDomBench } from "./dom-bench";

type SynapseBenchOptions = {
  label?: string;
  config?: BenchConfig;
  showOverlay?: boolean;
  onSample?: (sample: BenchSample) => void;
};

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
    "Synapse Bench (uncapped)",
    `Mode: ${label}`,
    `Rectangles: ${rects}`,
    `Draw calls: ${drawCalls}`,
    `Nodes: ${nodeCount}`,
    "",
    `FPS: ${fps.toFixed(1)}`,
    `Frame time: ${frameMs.toFixed(2)} ms`,
    `CPU render: ${cpuMs.toFixed(2)} ms`,
    `Update loop: ${updateMs.toFixed(2)} ms`,
    `Canvas: ${Math.round(canvasSize.x)}x${Math.round(canvasSize.y)} px`,
    "",
    "Params: ?rects=10000&size=10&speed=0.9&gpu=1&static=0",
  ].join("\n");
}

function createUncappedLoop(callback: () => void): { stop: () => void } {
  const channel = new MessageChannel();
  let running = true;

  channel.port1.onmessage = () => {
    if (!running) return;
    callback();
    channel.port2.postMessage(null);
  };

  channel.port2.postMessage(null);

  return {
    stop: () => {
      running = false;
      channel.port1.close();
      channel.port2.close();
    },
  };
}

export async function createSynapseBench(
  options: SynapseBenchOptions = {}
): Promise<BenchHandle> {
  const config = options.config ?? readBenchConfig({ defaultGpu: true, allowGpuParam: true });
  const showOverlay = options.showOverlay ?? true;

  if (!navigator.gpu) {
    return createDomBench({
      label: "DOM (fallback - no WebGPU)",
      config: { ...config, gpu: false },
      showOverlay,
      onSample: options.onSample,
    });
  }

  setPageBackground("#0b0b0f");

  const canvas = document.createElement("canvas");
  canvas.id = "synapse-bench";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.display = "block";
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.background = "#0b0b0f";

  document.body.appendChild(canvas);

  const overlay = showOverlay ? createOverlay() : null;
  if (overlay) {
    document.body.appendChild(overlay);
  }

  let engine: SynapseEngine;
  try {
    engine = await SynapseEngine.create(canvas);
  } catch (error) {
    console.error("Synapse failed to initialize:", error);
    canvas.remove();
    overlay?.remove();
    return createDomBench({
      label: "DOM (fallback - WebGPU init failed)",
      config: { ...config, gpu: false },
      showOverlay,
      onSample: options.onSample,
    });
  }

  engine.enableStats(true);

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
    const box = engine.createBox({ position, size, color });

    boxes.push(box);
    positions.push(position);
    velocities.push(velocity);
  }

  const gpuRequested = config.gpu && !config.static;
  const gpuEnabled = gpuRequested && engine.enableGpuSimulation(true, velocities);
  if (!gpuEnabled && gpuRequested) {
    console.warn("GPU simulation unavailable; using CPU updates.");
  }

  let frameCount = 0;
  let fpsWindowStart = performance.now();
  let currentFps = 0;
  let currentFrameMs = 0;
  let lastCpuMs = 0;
  let lastUpdateMs = 0;
  let lastOverlayUpdate = 0;

  let latestSample: BenchSample = {
    fps: 0,
    frameMs: 0,
    updateMs: 0,
    nodeCount: boxes.length,
    cpuMs: 0,
    drawCalls: 0,
  };

  const tick = (): void => {
    const frameStart = performance.now();

    const bounds = engine.getCanvasSize();
    const maxX = Math.max(0, bounds.x - sizePx);
    const maxY = Math.max(0, bounds.y - sizePx);

    if (!gpuEnabled && !config.static) {
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

    engine.renderFrame();

    const frameEnd = performance.now();
    lastCpuMs = frameEnd - frameStart;
    lastUpdateMs = config.static ? 0 : lastCpuMs;
    frameCount++;

    const elapsed = frameEnd - fpsWindowStart;
    if (elapsed >= 500) {
      currentFps = (frameCount / elapsed) * 1000;
      currentFrameMs = elapsed / frameCount;
      frameCount = 0;
      fpsWindowStart = frameEnd;
    }

    latestSample = {
      fps: currentFps,
      frameMs: currentFrameMs,
      updateMs: lastUpdateMs,
      nodeCount: boxes.length,
      cpuMs: lastCpuMs,
      drawCalls: 1,
    };

    options.onSample?.(latestSample);

    if (overlay) {
      const now = performance.now();
      if (now - lastOverlayUpdate > 120) {
        const label = gpuEnabled
          ? "Synapse (WebGPU + GPU sim)"
          : config.static
            ? "Synapse (WebGPU static)"
            : "Synapse (WebGPU CPU)";
        overlay.textContent = formatStats(
          label,
          config.rects,
          lastUpdateMs,
          currentFrameMs,
          currentFps,
          lastCpuMs,
          1,
          boxes.length,
          bounds
        );
        lastOverlayUpdate = now;
      }
    }
  };

  const loop = createUncappedLoop(tick);

  return {
    stop: () => {
      loop.stop();
      engine.destroy();
      canvas.remove();
      overlay?.remove();
    },
    getLatestSample: () => latestSample,
  };
}
