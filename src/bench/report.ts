import {
  BenchConfig,
  BenchSample,
  BenchHandle,
  parseNumber,
  readBenchConfig,
  setPageBackground,
} from "./common";
import { createDomBench } from "./dom-bench";
import { createSynapseBench } from "./synapse-bench";

type ReportSummary = {
  avgFps: number;
  medianFrameMs: number;
  p95FrameMs: number;
  p99FrameMs: number;
  minFrameMs: number;
  maxFrameMs: number;
  stdDevFrameMs: number;
  avgUpdateMs: number;
  avgCpuMs?: number;
  avgDrawCalls?: number;
};

type PhaseResult = {
  label: string;
  summary: ReportSummary;
  samples: number;
};

const DEFAULT_DURATION_MS = 4000;
const DEFAULT_WARMUP_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function computeSummary(samples: BenchSample[]): ReportSummary {
  if (samples.length === 0) {
    return {
      avgFps: 0,
      medianFrameMs: 0,
      p95FrameMs: 0,
      p99FrameMs: 0,
      minFrameMs: 0,
      maxFrameMs: 0,
      stdDevFrameMs: 0,
      avgUpdateMs: 0,
      avgCpuMs: undefined,
      avgDrawCalls: undefined,
    };
  }

  const fpsValues = samples.map((sample) => sample.fps);
  const frameValues = samples.map((sample) => sample.frameMs).sort((a, b) => a - b);
  const updateValues = samples.map((sample) => sample.updateMs);
  const cpuValues = samples
    .map((sample) => sample.cpuMs)
    .filter((value): value is number => value !== undefined);
  const drawValues = samples
    .map((sample) => sample.drawCalls)
    .filter((value): value is number => value !== undefined);

  const avg = (values: number[]): number =>
    values.reduce((sum, value) => sum + value, 0) / values.length;

  const variance = (values: number[], mean: number): number =>
    values.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / values.length;

  const p95Index = Math.min(frameValues.length - 1, Math.floor(frameValues.length * 0.95));
  const p99Index = Math.min(frameValues.length - 1, Math.floor(frameValues.length * 0.99));
  const medianIndex = Math.floor(frameValues.length * 0.5);
  const avgFrame = avg(frameValues);
  const stdDev = Math.sqrt(variance(frameValues, avgFrame));

  return {
    avgFps: avg(fpsValues),
    medianFrameMs: frameValues[medianIndex] ?? 0,
    p95FrameMs: frameValues[p95Index] ?? 0,
    p99FrameMs: frameValues[p99Index] ?? 0,
    minFrameMs: frameValues[0] ?? 0,
    maxFrameMs: frameValues[frameValues.length - 1] ?? 0,
    stdDevFrameMs: stdDev,
    avgUpdateMs: avg(updateValues),
    avgCpuMs: cpuValues.length ? avg(cpuValues) : undefined,
    avgDrawCalls: drawValues.length ? avg(drawValues) : undefined,
  };
}

function formatSummary(result: PhaseResult): string {
  const lines = [
    `${result.label}:`,
    `  Samples: ${result.samples}`,
    `  Avg FPS: ${result.summary.avgFps.toFixed(1)}`,
    `  Median Frame: ${result.summary.medianFrameMs.toFixed(2)} ms`,
    `  P95 Frame: ${result.summary.p95FrameMs.toFixed(2)} ms`,
    `  P99 Frame: ${result.summary.p99FrameMs.toFixed(2)} ms`,
    `  Min Frame: ${result.summary.minFrameMs.toFixed(2)} ms`,
    `  Max Frame: ${result.summary.maxFrameMs.toFixed(2)} ms`,
    `  Std Dev Frame: ${result.summary.stdDevFrameMs.toFixed(2)} ms`,
    `  Avg Update: ${result.summary.avgUpdateMs.toFixed(2)} ms`,
  ];

  if (result.summary.avgCpuMs !== undefined) {
    lines.push(`  Avg CPU Render: ${result.summary.avgCpuMs.toFixed(2)} ms`);
  }

  if (result.summary.avgDrawCalls !== undefined) {
    lines.push(`  Avg Draw Calls: ${result.summary.avgDrawCalls.toFixed(1)}`);
  }

  return lines.join("\n");
}

async function runPhase(
  label: string,
  create: () => Promise<BenchHandle> | BenchHandle,
  warmupMs: number,
  durationMs: number
): Promise<PhaseResult> {
  const samples: BenchSample[] = [];
  const handle = await Promise.resolve(create());

  await sleep(warmupMs);
  samples.length = 0;

  const onSample = () => {
    samples.push(handle.getLatestSample());
  };

  const sampleInterval = window.setInterval(onSample, 100);
  await sleep(durationMs);
  window.clearInterval(sampleInterval);

  handle.stop();

  return {
    label,
    summary: computeSummary(samples),
    samples: samples.length,
  };
}

async function runReport(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const durationMs = Math.max(500, parseNumber(params.get("duration"), DEFAULT_DURATION_MS));
  const warmupMs = Math.max(0, parseNumber(params.get("warmup"), DEFAULT_WARMUP_MS));
  const format = (params.get("format") ?? "text").toLowerCase();

  const baseConfig = readBenchConfig({ defaultGpu: true, allowGpuParam: true });
  const domConfig: BenchConfig = { ...baseConfig, gpu: false };

  setPageBackground("#0b0b0f");

  const report = document.createElement("pre");
  report.style.position = "fixed";
  report.style.inset = "0";
  report.style.margin = "0";
  report.style.padding = "24px";
  report.style.color = "#e2e8f0";
  report.style.fontFamily =
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
  report.style.fontSize = "13px";
  report.style.lineHeight = "1.5";
  report.textContent = "Synapse Bench Report\nRunning...";
  document.body.appendChild(report);

  const synapseLabel = navigator.gpu ? "Synapse" : "Synapse (fallback DOM)";
  const synapsePhase = await runPhase(
    synapseLabel,
    () =>
      createSynapseBench({
        config: baseConfig,
        showOverlay: false,
      }),
    warmupMs,
    durationMs
  );

  const domPhase = await runPhase(
    "DOM",
    () =>
      createDomBench({
        config: domConfig,
        showOverlay: false,
      }),
    warmupMs,
    durationMs
  );

  const ratio = domPhase.summary.avgFps > 0
    ? synapsePhase.summary.avgFps / domPhase.summary.avgFps
    : 0;

  const payload = {
    config: {
      rects: baseConfig.rects,
      size: baseConfig.size,
      speed: baseConfig.speed,
      static: baseConfig.static,
      gpu: baseConfig.gpu,
      durationMs,
      warmupMs,
    },
    synapse: synapsePhase,
    dom: domPhase,
    ratio,
  };

  if (format === "json") {
    report.textContent = JSON.stringify(payload, null, 2);
    return;
  }

  if (format === "csv") {
    const lines = [
      "label,avgFps,medianFrameMs,p95FrameMs,p99FrameMs,minFrameMs,maxFrameMs,stdDevFrameMs,avgUpdateMs,avgCpuMs,avgDrawCalls,samples",
      `${synapsePhase.label},${synapsePhase.summary.avgFps.toFixed(2)},${synapsePhase.summary.medianFrameMs.toFixed(2)},${synapsePhase.summary.p95FrameMs.toFixed(2)},${synapsePhase.summary.p99FrameMs.toFixed(2)},${synapsePhase.summary.minFrameMs.toFixed(2)},${synapsePhase.summary.maxFrameMs.toFixed(2)},${synapsePhase.summary.stdDevFrameMs.toFixed(2)},${synapsePhase.summary.avgUpdateMs.toFixed(2)},${synapsePhase.summary.avgCpuMs?.toFixed(2) ?? ""},${synapsePhase.summary.avgDrawCalls?.toFixed(2) ?? ""},${synapsePhase.samples}`,
      `${domPhase.label},${domPhase.summary.avgFps.toFixed(2)},${domPhase.summary.medianFrameMs.toFixed(2)},${domPhase.summary.p95FrameMs.toFixed(2)},${domPhase.summary.p99FrameMs.toFixed(2)},${domPhase.summary.minFrameMs.toFixed(2)},${domPhase.summary.maxFrameMs.toFixed(2)},${domPhase.summary.stdDevFrameMs.toFixed(2)},${domPhase.summary.avgUpdateMs.toFixed(2)},${domPhase.summary.avgCpuMs?.toFixed(2) ?? ""},${domPhase.summary.avgDrawCalls?.toFixed(2) ?? ""},${domPhase.samples}`,
    ];
    report.textContent = lines.join("\n");
    return;
  }

  report.textContent = [
    "Synapse Bench Report",
    "",
    `Config: rects=${baseConfig.rects}, size=${baseConfig.size}, speed=${baseConfig.speed}, static=${baseConfig.static}, gpu=${baseConfig.gpu}`,
    `Duration: ${durationMs}ms, Warmup: ${warmupMs}ms`,
    "",
    formatSummary(synapsePhase),
    "",
    formatSummary(domPhase),
    "",
    `Synapse / DOM FPS ratio: ${ratio.toFixed(2)}x`,
    "",
    "Params: ?rects=5000&size=10&speed=0.9&gpu=1&static=0&duration=4000&warmup=1000&format=json",
  ].join("\n");
}

runReport().catch((error) => {
  console.error("Bench report failed:", error);
});
