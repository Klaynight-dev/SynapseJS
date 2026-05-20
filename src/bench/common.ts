export type BenchConfig = {
  rects: number;
  size: number;
  speed: number;
  gpu: boolean;
};

export type BenchConfigOptions = {
  defaultGpu?: boolean;
  allowGpuParam?: boolean;
  maxRects?: number;
};

const DEFAULT_CONFIG: BenchConfig = {
  rects: 2500,
  size: 12,
  speed: 0.9,
  gpu: true,
};

export type FrameStats = {
  fps: number;
  frameMs: number;
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function parseNumber(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readBenchConfig(options: BenchConfigOptions = {}): BenchConfig {
  const params = new URLSearchParams(window.location.search);
  const maxRects = options.maxRects ?? 50000;
  const defaultGpu = options.defaultGpu ?? DEFAULT_CONFIG.gpu;
  const allowGpuParam = options.allowGpuParam ?? true;
  const gpuParam = params.get("gpu");
  const gpu = allowGpuParam
    ? gpuParam
      ? gpuParam !== "0" && gpuParam !== "false"
      : defaultGpu
    : defaultGpu;

  return {
    rects: Math.floor(
      clamp(parseNumber(params.get("rects"), DEFAULT_CONFIG.rects), 1, maxRects)
    ),
    size: Math.floor(clamp(parseNumber(params.get("size"), DEFAULT_CONFIG.size), 2, 128)),
    speed: clamp(parseNumber(params.get("speed"), DEFAULT_CONFIG.speed), 0.1, 8),
    gpu,
  };
}

export function createOverlay(): HTMLDivElement {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "16px";
  overlay.style.left = "16px";
  overlay.style.padding = "12px 14px";
  overlay.style.borderRadius = "12px";
  overlay.style.background = "rgba(15, 15, 20, 0.8)";
  overlay.style.color = "#e2e8f0";
  overlay.style.fontFamily =
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
  overlay.style.fontSize = "12px";
  overlay.style.lineHeight = "1.4";
  overlay.style.whiteSpace = "pre";
  overlay.style.pointerEvents = "none";
  return overlay;
}

export function setPageBackground(color: string): void {
  document.body.style.margin = "0";
  document.body.style.background = color;
}

export function createFrameWindow(windowSize = 120): { record: (stamp: number) => FrameStats } {
  const frameTimes: number[] = [];
  let frameTimeSum = 0;
  let frameTimeIndex = 0;
  let frameTimeCount = 0;
  let lastStamp = 0;
  let lastDelta = 0;
  let lastFps = 0;

  const record = (stamp: number): FrameStats => {
    if (lastStamp > 0) {
      const delta = stamp - lastStamp;
      if (delta > 0) {
        lastDelta = delta;
        if (frameTimeCount < windowSize) {
          frameTimes.push(delta);
          frameTimeSum += delta;
          frameTimeCount += 1;
        } else {
          const index = frameTimeIndex % windowSize;
          frameTimeSum += delta - frameTimes[index];
          frameTimes[index] = delta;
          frameTimeIndex += 1;
        }
        const average = frameTimeSum / frameTimeCount;
        lastFps = average > 0 ? 1000 / average : 0;
      }
    }

    lastStamp = stamp;
    return { fps: lastFps, frameMs: lastDelta };
  };

  return { record };
}
