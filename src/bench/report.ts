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
  estimatedMaxFps?: number;
  frameBudgetPercent?: number;
};

type PhaseResult = {
  label: string;
  summary: ReportSummary;
  samples: number;
};

const DEFAULT_DURATION_MS = 6000;
const DEFAULT_WARMUP_MS = 2000;

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

  const fpsValues = samples.map((s) => s.fps);
  const frameValues = samples.map((s) => s.frameMs).sort((a, b) => a - b);
  const updateValues = samples.map((s) => s.updateMs);
  const cpuValues = samples
    .map((s) => s.cpuMs)
    .filter((v): v is number => v !== undefined && v > 0);
  const drawValues = samples
    .map((s) => s.drawCalls)
    .filter((v): v is number => v !== undefined);

  const avg = (values: number[]): number =>
    values.reduce((sum, v) => sum + v, 0) / values.length;

  const variance = (values: number[], mean: number): number =>
    values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / values.length;

  const p95Index = Math.min(frameValues.length - 1, Math.floor(frameValues.length * 0.95));
  const p99Index = Math.min(frameValues.length - 1, Math.floor(frameValues.length * 0.99));
  const medianIndex = Math.floor(frameValues.length * 0.5);
  const avgFrame = avg(frameValues);
  const stdDev = Math.sqrt(variance(frameValues, avgFrame));
  const avgCpuMs = cpuValues.length ? avg(cpuValues) : undefined;

  return {
    avgFps: avg(fpsValues),
    medianFrameMs: frameValues[medianIndex] ?? 0,
    p95FrameMs: frameValues[p95Index] ?? 0,
    p99FrameMs: frameValues[p99Index] ?? 0,
    minFrameMs: frameValues[0] ?? 0,
    maxFrameMs: frameValues[frameValues.length - 1] ?? 0,
    stdDevFrameMs: stdDev,
    avgUpdateMs: avg(updateValues),
    avgCpuMs,
    avgDrawCalls: drawValues.length ? avg(drawValues) : undefined,
    estimatedMaxFps: avgCpuMs && avgCpuMs > 0 ? 1000 / avgCpuMs : undefined,
    frameBudgetPercent: avgCpuMs ? (avgCpuMs / 16.67) * 100 : undefined,
  };
}

function formatSummary(result: PhaseResult): string {
  const s = result.summary;
  const lines = [
    `${result.label}:`,
    `  Samples: ${result.samples}`,
    `  Avg FPS: ${s.avgFps.toFixed(1)}`,
    `  Median Frame: ${s.medianFrameMs.toFixed(2)} ms`,
    `  P95 Frame: ${s.p95FrameMs.toFixed(2)} ms`,
    `  P99 Frame: ${s.p99FrameMs.toFixed(2)} ms`,
    `  Min/Max Frame: ${s.minFrameMs.toFixed(2)} / ${s.maxFrameMs.toFixed(2)} ms`,
    `  Std Dev: ${s.stdDevFrameMs.toFixed(2)} ms`,
    `  Avg Update: ${s.avgUpdateMs.toFixed(2)} ms`,
  ];

  if (s.avgCpuMs !== undefined) {
    lines.push(`  Avg CPU Work: ${s.avgCpuMs.toFixed(2)} ms`);
  }

  if (s.avgDrawCalls !== undefined) {
    lines.push(`  Avg Draw Calls: ${s.avgDrawCalls.toFixed(1)}`);
  }

  if (s.estimatedMaxFps !== undefined) {
    lines.push(`  Est. Max FPS: ${s.estimatedMaxFps.toFixed(0)} (1000/cpuMs)`);
  }

  if (s.frameBudgetPercent !== undefined) {
    lines.push(`  Frame Budget Used: ${s.frameBudgetPercent.toFixed(1)}%`);
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
  report.style.overflow = "auto";
  report.textContent = `Synapse Bench Report\nRunning with ${baseConfig.rects} rectangles...\n\nPhase 1/2: Synapse (warmup ${warmupMs}ms + measure ${durationMs}ms)`;
  document.body.appendChild(report);

  const synapseLabel = navigator.gpu ? "Synapse (WebGPU)" : "Synapse (fallback DOM)";
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

  report.textContent += `\n  → done (${synapsePhase.samples} samples)\n\nPhase 2/2: DOM baseline (warmup ${warmupMs}ms + measure ${durationMs}ms)`;

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

  const fpsRatio = domPhase.summary.avgFps > 0
    ? synapsePhase.summary.avgFps / domPhase.summary.avgFps
    : 0;

  const synCpu = synapsePhase.summary.avgCpuMs ?? synapsePhase.summary.avgUpdateMs;
  const domCpu = domPhase.summary.avgCpuMs ?? domPhase.summary.avgUpdateMs;
  const cpuRatio = synCpu > 0 && domCpu > 0 ? domCpu / synCpu : 0;

  const synEstMax = synapsePhase.summary.estimatedMaxFps ?? 0;
  const domEstMax = domPhase.summary.estimatedMaxFps ?? (domCpu > 0 ? 1000 / domCpu : 0);
  const estFpsRatio = domEstMax > 0 ? synEstMax / domEstMax : 0;

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
    fpsRatio,
    cpuRatio,
    estimatedFpsRatio: estFpsRatio,
  };

  if (format === "json") {
    report.textContent = JSON.stringify(payload, null, 2);
    return;
  }

  if (format === "csv") {
    const lines = [
      "label,avgFps,medianFrameMs,p95FrameMs,p99FrameMs,minFrameMs,maxFrameMs,stdDevFrameMs,avgUpdateMs,avgCpuMs,avgDrawCalls,estMaxFps,frameBudget%,samples",
      formatCsvRow(synapsePhase),
      formatCsvRow(domPhase),
    ];
    report.textContent = lines.join("\n");
    return;
  }

  const vsynced = synapsePhase.summary.avgFps > 55 && synapsePhase.summary.avgFps < 65
    && domPhase.summary.avgFps > 55 && domPhase.summary.avgFps < 65;

  const lines = [
    "═══════════════════════════════════════════════════",
    "             SYNAPSE BENCH REPORT",
    "═══════════════════════════════════════════════════",
    "",
    `Config: ${baseConfig.rects} rects, ${baseConfig.size}px, speed=${baseConfig.speed}`,
    `        gpu=${baseConfig.gpu}, static=${baseConfig.static}`,
    `        duration=${durationMs}ms, warmup=${warmupMs}ms`,
    "",
    "───────────────────────────────────────────────────",
    "",
    formatSummary(synapsePhase),
    "",
    formatSummary(domPhase),
    "",
    "───────────────────────────────────────────────────",
    "                  COMPARISON",
    "───────────────────────────────────────────────────",
    "",
  ];

  if (vsynced) {
    lines.push(
      "⚠ Both engines hit vsync cap (~60 FPS). FPS ratio is",
      "  meaningless. CPU time ratio reflects true performance.",
      ""
    );
  }

  lines.push(
    `  FPS ratio:          ${fpsRatio.toFixed(2)}x${vsynced ? " (vsync-capped)" : ""}`,
    `  CPU time ratio:     ${cpuRatio.toFixed(2)}x faster`,
    `  Synapse CPU work:   ${synCpu.toFixed(2)} ms/frame`,
    `  DOM CPU work:       ${domCpu.toFixed(2)} ms/frame`,
  );

  if (synEstMax > 0) {
    lines.push(
      "",
      `  Est. max FPS (Synapse): ${synEstMax.toFixed(0)}`,
      `  Est. max FPS (DOM):     ${domEstMax.toFixed(0)}`,
      `  Estimated FPS ratio:    ${estFpsRatio.toFixed(2)}x`,
    );
  }

  lines.push(
    "",
    "═══════════════════════════════════════════════════",
    "",
    "Params: ?rects=10000&size=10&speed=0.9&gpu=1&static=0",
    "        &duration=6000&warmup=2000&format=json|csv|text",
  );

  report.textContent = lines.join("\n");
}

function formatCsvRow(phase: PhaseResult): string {
  const s = phase.summary;
  return [
    phase.label,
    s.avgFps.toFixed(2),
    s.medianFrameMs.toFixed(2),
    s.p95FrameMs.toFixed(2),
    s.p99FrameMs.toFixed(2),
    s.minFrameMs.toFixed(2),
    s.maxFrameMs.toFixed(2),
    s.stdDevFrameMs.toFixed(2),
    s.avgUpdateMs.toFixed(2),
    s.avgCpuMs?.toFixed(2) ?? "",
    s.avgDrawCalls?.toFixed(2) ?? "",
    s.estimatedMaxFps?.toFixed(0) ?? "",
    s.frameBudgetPercent?.toFixed(1) ?? "",
    phase.samples,
  ].join(",");
}

runReport().catch((error) => {
  console.error("Bench report failed:", error);
});
