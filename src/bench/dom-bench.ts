import {
  BenchConfig,
  BenchHandle,
  BenchSample,
  clamp,
  createFrameWindow,
  createOverlay,
  readBenchConfig,
  setPageBackground,
} from "./common";

type DomBenchOptions = {
  label?: string;
  config?: BenchConfig;
  showOverlay?: boolean;
  onSample?: (sample: BenchSample) => void;
};

function formatStats(
  label: string,
  config: BenchConfig,
  updateMs: number,
  frameMs: number,
  fps: number,
  nodeCount: number,
  sizePx: number,
  bounds: { width: number; height: number }
): string {
  return [
    "Synapse Bench",
    `Mode: ${label}`,
    `Rectangles: ${config.rects}`,
    `Nodes: ${nodeCount}`,
    `FPS: ${fps.toFixed(1)}`,
    `Frame time: ${frameMs.toFixed(2)} ms`,
    `Update loop: ${updateMs.toFixed(2)} ms`,
    `Element size: ${sizePx}px`,
    `Viewport: ${Math.round(bounds.width)}x${Math.round(bounds.height)} px`,
    "Params: ?rects=5000&size=10&speed=0.9&static=1",
  ].join("\n");
}

export function createDomBench(options: DomBenchOptions = {}): BenchHandle {
  const config =
    options.config ?? readBenchConfig({ defaultGpu: false, allowGpuParam: false });
  const label =
    options.label ?? (config.static ? "DOM (static)" : "DOM (no Synapse)");
  const showOverlay = options.showOverlay ?? true;

  setPageBackground("#0b0b0f");

  const root = document.createElement("div");
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.overflow = "hidden";
  root.style.background = "#0b0b0f";

  document.body.appendChild(root);

  const overlay = showOverlay ? createOverlay() : null;
  if (overlay) {
    document.body.appendChild(overlay);
  }

  const palette = ["#33a0f2", "#f27033", "#33e695", "#f2e533"];
  const elements: HTMLDivElement[] = [];
  const positions: { x: number; y: number }[] = [];
  const velocities: { x: number; y: number }[] = [];

  const sizePx = config.size;
  const speedPx = config.speed;

  const bounds = root.getBoundingClientRect();
  const maxInitialX = Math.max(0, bounds.width - sizePx);
  const maxInitialY = Math.max(0, bounds.height - sizePx);

  for (let i = 0; i < config.rects; i += 1) {
    const element = document.createElement("div");
    element.style.position = "absolute";
    element.style.width = `${sizePx}px`;
    element.style.height = `${sizePx}px`;
    element.style.background = palette[i % palette.length];
    element.style.willChange = "transform";

    const position = {
      x: Math.random() * maxInitialX,
      y: Math.random() * maxInitialY,
    };
    const velocity = {
      x: (Math.random() * 2 - 1) * speedPx,
      y: (Math.random() * 2 - 1) * speedPx,
    };

    element.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
    root.appendChild(element);

    elements.push(element);
    positions.push(position);
    velocities.push(velocity);
  }

  const frameWindow = createFrameWindow();
  let updateMs = 0;
  let lastOverlayUpdate = 0;
  let rafId = 0;
  let running = true;
  let latestSample: BenchSample = {
    fps: 0,
    frameMs: 0,
    updateMs: 0,
    nodeCount: elements.length,
  };

  const tick = (): void => {
    if (!running) {
      return;
    }

    const frameStart = performance.now();
    const rect = root.getBoundingClientRect();
    const maxX = Math.max(0, rect.width - sizePx);
    const maxY = Math.max(0, rect.height - sizePx);

    if (!config.static) {
      for (let i = 0; i < elements.length; i += 1) {
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

        elements[i].style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
      }
    }

    updateMs = config.static ? 0 : performance.now() - frameStart;
    const frameStats = frameWindow.record(frameStart);

    latestSample = {
      fps: frameStats.fps,
      frameMs: frameStats.frameMs,
      updateMs,
      nodeCount: elements.length,
    };

    options.onSample?.(latestSample);

    if (overlay) {
      const now = performance.now();
      if (now - lastOverlayUpdate > 120) {
        overlay.textContent = formatStats(
          label,
          config,
          updateMs,
          frameStats.frameMs,
          frameStats.fps,
          elements.length,
          sizePx,
          rect
        );
        lastOverlayUpdate = now;
      }
    }

    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return {
    stop: () => {
      running = false;
      cancelAnimationFrame(rafId);
      root.remove();
      overlay?.remove();
    },
    getLatestSample: () => latestSample,
  };
}

export async function runDomBench(options: DomBenchOptions = {}): Promise<void> {
  createDomBench(options);
}
