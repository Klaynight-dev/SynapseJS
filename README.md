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
http://localhost:5173/bench-report.html?rects=5000&size=10&speed=0.9&gpu=1&static=0&duration=4000&warmup=1000
```

## Synapse Bench Report (2026-05-21)

```
Config: rects=2500, size=12, speed=0.9, static=false, gpu=true
Duration: 4000ms, Warmup: 1000ms

Synapse:
	Samples: 39
	Avg FPS: 127.8
	P95 Frame: 8.00 ms
	Avg Update: 0.00 ms
	Avg CPU Render: 0.10 ms
	Avg Draw Calls: 1.0

DOM:
	Samples: 34
	Avg FPS: 32.9
	P95 Frame: 53.00 ms
	Avg Update: 10.15 ms

Synapse / DOM FPS ratio: 3.89x
```

## Architecture

- Synapse-Core: init WebGPU, scene graph en RAM, instancing, raycaster.
- Synapse-Shaders: WGSL pour primitives UI (rects, SDF texte, effets).
- Synapse-Adapters: wrappers pour frameworks (React/Svelte/Angular).

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
