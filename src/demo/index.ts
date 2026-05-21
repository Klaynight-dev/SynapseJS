import { Color4, SynapseEngine } from "../core";

async function main(): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.id = "synapse-root";
  canvas.style.width = "900px";
  canvas.style.height = "520px";
  canvas.style.display = "block";
  canvas.style.background = "#0b0b0f";

  document.body.style.margin = "0";
  document.body.style.background = "#0b0b0f";
  document.body.appendChild(canvas);

  const engine = await SynapseEngine.create(canvas);
  engine.start();

  const baseColor: Color4 = { r: 0.2, g: 0.6, b: 0.95, a: 1.0 };
  const hoverColor: Color4 = { r: 0.95, g: 0.45, b: 0.2, a: 1.0 };
  const activeColor: Color4 = { r: 0.2, g: 0.9, b: 0.55, a: 1.0 };

  const button = engine.createBox({
    position: { x: 80, y: 80 },
    size: { x: 260, y: 84 },
    color: baseColor,
    hoverColor,
    radius: 18,
    softness: 2,
    gradientColor: { r: 0.1, g: 0.4, b: 0.8, a: 1.0 },
    gradientMix: 0.6,
    shadowColor: { r: 0, g: 0, b: 0, a: 0.35 },
    shadowOffset: { x: 0, y: 10 },
    shadowBlur: 18,
    shadowSpread: 2,
  });

  let toggled = false;
  button.onClick(() => {
    toggled = !toggled;
    button.setColor(toggled ? activeColor : baseColor);
  });
}

main().catch((error) => {
  console.error("Synapse demo failed:", error);
});
