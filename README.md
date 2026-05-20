# Synapse.js PoC

PoC du core Synapse.js (WebGPU + scene graph), demo vanilla, pont React, et benchmark GPU.

## Demarrer

```bash
bun install
bun run dev
```

Ouvrir l'URL affiche la demo vanilla.

## Benchmark

```bash
bun run bench
```

DOM baseline:

```bash
bun run bench:dom
```

Parametres optionnels:
- rects: nombre de rectangles
- size: taille en px CSS
- speed: vitesse par frame

Exemple:
```
http://localhost:5173/bench.html?rects=5000&size=10&speed=0.9&gpu=1
```

Le parametre gpu active la simulation sur GPU (compute pass).
Utilise gpu=0 pour garder la version CPU.
Si WebGPU est indisponible, le bench Synapse bascule vers le bench DOM.

DOM page:
```
http://localhost:5173/bench-dom.html?rects=5000&size=10&speed=0.9
```

## Structure

- Core WebGPU: src/synapse-core.ts
- Shader WGSL: src/ui.wgsl
- Compute WGSL: src/sim.wgsl
- Demo vanilla: src/index.ts
- Benchmark: src/bench/synapse-bench.ts
- Benchmark DOM: src/bench/dom-bench.ts
- Adaptateur React: src/adapters/react-bridge.tsx
```
