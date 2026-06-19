import type {
  BoxProps,
  Vec2,
  Color4,
  SynapsePointerEvent,
  PointerHandler,
} from "../core";
import { SynapseEngine } from "../core";
import type { SynapseBox } from "../core";

export interface SynapseCanvasHandle {
  engine: SynapseEngine;
  destroy: () => void;
}

export async function initSynapseCanvas(
  canvas: HTMLCanvasElement
): Promise<SynapseCanvasHandle> {
  const engine = await SynapseEngine.create(canvas);
  engine.start();
  return {
    engine,
    destroy() {
      engine.destroy();
    },
  };
}

export interface SynapseRectHandle {
  box: SynapseBox;
  update: (props: Partial<BoxProps>) => void;
  setHandlers: (handlers: {
    onClick?: PointerHandler;
    onPointerEnter?: PointerHandler;
    onPointerLeave?: PointerHandler;
  }) => void;
  destroy: () => void;
}

export function createSynapseRect(
  engine: SynapseEngine,
  props: BoxProps,
  handlers?: {
    onClick?: PointerHandler;
    onPointerEnter?: PointerHandler;
    onPointerLeave?: PointerHandler;
  }
): SynapseRectHandle {
  const box = engine.createBox(props);

  if (handlers?.onClick) box.onClick(handlers.onClick);
  if (handlers?.onPointerEnter) box.onPointerEnter(handlers.onPointerEnter);
  if (handlers?.onPointerLeave) box.onPointerLeave(handlers.onPointerLeave);

  return {
    box,
    update(updates: Partial<BoxProps>) {
      box.update(updates);
    },
    setHandlers(h) {
      box.onClick(h.onClick);
      box.onPointerEnter(h.onPointerEnter);
      box.onPointerLeave(h.onPointerLeave);
    },
    destroy() {
      box.destroy();
    },
  };
}

export interface SynapseTextHandle {
  id: number;
  update: (updates: Partial<{ position: Vec2; text: string; fontSize: number; color: Color4 }>) => void;
  destroy: () => void;
}

export async function createSynapseText(
  engine: SynapseEngine,
  props: { position: Vec2; text: string; fontSize: number; color: Color4 }
): Promise<SynapseTextHandle> {
  await engine.initTextRenderer(props.fontSize);
  const id = engine.addText(props);

  return {
    id,
    update(updates) {
      engine.updateText(id, updates);
    },
    destroy() {
      engine.removeText(id);
    },
  };
}

export { SynapseEngine };
export type { BoxProps, Vec2, Color4, SynapsePointerEvent, PointerHandler };
