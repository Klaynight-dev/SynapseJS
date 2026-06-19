# Synapse.js

<p align="center">
	<img src="assets/synapse-logo.svg" width="520" alt="Synapse.js logo" />
</p>

Synapse.js est un moteur de rendu Zero-DOM pour le web. Il transforme n'importe quel framework en une cible WebGPU, avec un scene graph en RAM et un pipeline GPU pur.

## Pourquoi Synapse

- Zero-DOM: aucun layout, aucun style recalcul, aucune inflation DOM.
- Instancing GPU: 1 draw call pour des milliers d'elements.
- Scene graph type: props strictes, adapters agnostiques (Vanilla/React/Svelte/Angular).
- Bench complet: DOM vs Synapse, mode GPU/CPU, mode static.

## Demarrer

```bash
bun install
bun run dev
```

Ouvrir l'URL affiche la demo vanilla.

## Benchmarks

```bash
bun run bench
```

DOM baseline:

```bash
bun run bench:dom
```

Rapport compare (Synapse vs DOM):

```bash
bun run bench:report
```

Parametres optionnels:
- rects: nombre de rectangles
- size: taille en px CSS
- speed: vitesse par frame
- gpu: simulation GPU (compute pass)
- static: desactive les updates (mesure le rendu statique)
- format: json ou csv pour le report

Exemple:
```
http://localhost:5173/bench.html?rects=5000&size=10&speed=0.9&gpu=1&static=0
```

Si WebGPU est indisponible, le bench Synapse bascule automatiquement vers le bench DOM.

DOM page:
```
http://localhost:5173/bench-dom.html?rects=5000&size=10&speed=0.9
```

Rapport:
```
http://localhost:5173/bench-report.html?rects=5000&size=10&speed=0.9&gpu=1&static=0&duration=4000&warmup=1000&format=json
```

## Synapse Bench Report (2026-05-21)

```yml
═══════════════════════════════════════════════════
             SYNAPSE BENCH REPORT
═══════════════════════════════════════════════════

Config: 10000 rects, 12px, speed=0.9
        gpu=true, static=false
        duration=6000ms, warmup=2000ms

───────────────────────────────────────────────────

Synapse (WebGPU):
  Samples: 32
  Avg FPS: 857.6
  Median Frame: 1.02 ms
  P95 Frame: 8.42 ms
  P99 Frame: 9.10 ms
  Min/Max Frame: 0.95 / 9.10 ms
  Std Dev: 2.39 ms
  Avg Update: 2.05 ms
  Avg CPU Work: 2.05 ms
  Avg Draw Calls: 1.0
  Est. Max FPS: 489 (1000/cpuMs)
  Frame Budget Used: 12.3%

DOM:
  Samples: 31
  Avg FPS: 13.9
  Median Frame: 65.44 ms
  P95 Frame: 165.15 ms
  P99 Frame: 168.37 ms
  Min/Max Frame: 61.30 / 168.37 ms
  Std Dev: 32.53 ms
  Avg Update: 16.31 ms
  Avg CPU Work: 16.31 ms
  Est. Max FPS: 61 (1000/cpuMs)
  Frame Budget Used: 97.9%

───────────────────────────────────────────────────
                  COMPARISON
───────────────────────────────────────────────────

  FPS ratio:          61.87x
  CPU time ratio:     7.97x faster
  Synapse CPU work:   2.05 ms/frame
  DOM CPU work:       16.31 ms/frame

  Est. max FPS (Synapse): 489
  Est. max FPS (DOM):     61
  Estimated FPS ratio:    7.97x

═══════════════════════════════════════════════════

Params: ?rects=10000&size=10&speed=0.9&gpu=1&static=0
        &duration=6000&warmup=2000&format=json|csv|text
```

## Architecture

- Synapse-Core: init WebGPU, scene graph en RAM, instancing, raycaster.
- Synapse-Shaders: WGSL pour primitives UI (rects, SDF texte, effets).
- Synapse-Adapters: wrappers pour frameworks (React/Svelte/Angular).
- UI styles: radius, gradient, shadow via WGSL.

## Structure

- Core WebGPU: src/synapse-core.ts
- Shader WGSL: src/ui.wgsl
- Compute WGSL: src/sim.wgsl
- Demo vanilla: src/index.ts
- Benchmark: src/bench/synapse-bench.ts
- Benchmark Entry: src/bench/synapse-entry.ts
- Benchmark DOM: src/bench/dom-bench.ts
- Benchmark Report: src/bench/report.ts
- Adaptateur React: src/adapters/react-bridge.tsx
