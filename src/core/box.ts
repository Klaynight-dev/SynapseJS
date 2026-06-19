import type { BoxProps, Color4, Vec2, PointerHandler } from "./types";
import type { SynapseEngine } from "./engine";

export class SynapseBox {
  constructor(private engine: SynapseEngine, public readonly id: number) {}

  update(props: Partial<BoxProps>): void {
    this.engine.updateBox(this.id, props);
  }

  setPosition(position: Vec2): void {
    this.engine.updateBox(this.id, { position });
  }

  setSize(size: Vec2): void {
    this.engine.updateBox(this.id, { size });
  }

  setColor(color: Color4): void {
    this.engine.updateBox(this.id, { color });
  }

  setHoverColor(hoverColor?: Color4): void {
    this.engine.updateBox(this.id, { hoverColor });
  }

  onClick(handler?: PointerHandler): void {
    this.engine.setNodeHandlers(this.id, { onClick: handler });
  }

  onPointerEnter(handler?: PointerHandler): void {
    this.engine.setNodeHandlers(this.id, { onPointerEnter: handler });
  }

  onPointerLeave(handler?: PointerHandler): void {
    this.engine.setNodeHandlers(this.id, { onPointerLeave: handler });
  }

  destroy(): void {
    this.engine.removeNode(this.id);
  }
}
