import {
  createSignal,
  createContext,
  useContext,
  onMount,
  onCleanup,
  createEffect,
  type JSX,
  type Accessor,
} from "solid-js";
import type {
  BoxProps,
  Vec2,
  Color4,
  SynapsePointerEvent,
} from "../core";
import { SynapseEngine } from "../core";
import type { SynapseBox } from "../core";

const EngineContext = createContext<Accessor<SynapseEngine | null>>();

export function useEngine(): SynapseEngine | null {
  const accessor = useContext(EngineContext);
  return accessor?.() ?? null;
}

export type SynapseCanvasProps = {
  width: number;
  height: number;
  class?: string;
  style?: JSX.CSSProperties;
  children?: JSX.Element;
};

export function SynapseCanvas(props: SynapseCanvasProps): JSX.Element {
  let canvasRef: HTMLCanvasElement | undefined;
  const [engine, setEngine] = createSignal<SynapseEngine | null>(null);

  onMount(async () => {
    if (!canvasRef) return;
    try {
      const created = await SynapseEngine.create(canvasRef);
      created.start();
      setEngine(created);
    } catch (error) {
      console.error("Synapse engine failed to initialize:", error);
    }
  });

  onCleanup(() => {
    engine()?.destroy();
    setEngine(null);
  });

  return (
    <EngineContext.Provider value={engine}>
      <canvas
        ref={canvasRef}
        class={props.class}
        style={{
          width: `${props.width}px`,
          height: `${props.height}px`,
          display: "block",
          ...props.style,
        }}
      />
      {engine() ? props.children : null}
    </EngineContext.Provider>
  );
}

export type SynapseRectProps = BoxProps & {
  onClick?: (event: SynapsePointerEvent) => void;
  onPointerEnter?: (event: SynapsePointerEvent) => void;
  onPointerLeave?: (event: SynapsePointerEvent) => void;
};

export function SynapseRect(props: SynapseRectProps): null {
  const engineAccessor = useContext(EngineContext);
  let box: SynapseBox | null = null;

  createEffect(() => {
    const engine = engineAccessor?.();
    if (!engine) return;

    box?.destroy();
    box = engine.createBox({
      position: props.position,
      size: props.size,
      color: props.color,
      hoverColor: props.hoverColor,
      radius: props.radius,
      softness: props.softness,
      gradientColor: props.gradientColor,
      gradientMix: props.gradientMix,
      shadowColor: props.shadowColor,
      shadowOffset: props.shadowOffset,
      shadowBlur: props.shadowBlur,
      shadowSpread: props.shadowSpread,
      parentId: props.parentId,
      clipChildren: props.clipChildren,
    });
  });

  createEffect(() => {
    if (!box) return;
    box.update({
      position: props.position,
      size: props.size,
      color: props.color,
      hoverColor: props.hoverColor,
      radius: props.radius,
      softness: props.softness,
      gradientColor: props.gradientColor,
      gradientMix: props.gradientMix,
      shadowColor: props.shadowColor,
      shadowOffset: props.shadowOffset,
      shadowBlur: props.shadowBlur,
      shadowSpread: props.shadowSpread,
    });
  });

  createEffect(() => {
    if (!box) return;
    box.onClick(props.onClick);
    box.onPointerEnter(props.onPointerEnter);
    box.onPointerLeave(props.onPointerLeave);
  });

  onCleanup(() => {
    box?.destroy();
    box = null;
  });

  return null;
}

export type SynapseTextProps = {
  position: Vec2;
  text: string;
  fontSize: number;
  color: Color4;
};

export function SynapseText(props: SynapseTextProps): null {
  const engineAccessor = useContext(EngineContext);
  let textId: number | null = null;

  createEffect(async () => {
    const engine = engineAccessor?.();
    if (!engine) return;

    if (textId !== null) {
      engine.removeText(textId);
    }

    await engine.initTextRenderer(props.fontSize);
    textId = engine.addText({
      position: props.position,
      text: props.text,
      fontSize: props.fontSize,
      color: props.color,
    });
  });

  createEffect(() => {
    const engine = engineAccessor?.();
    if (textId === null || !engine) return;
    engine.updateText(textId, {
      position: props.position,
      text: props.text,
      fontSize: props.fontSize,
      color: props.color,
    });
  });

  onCleanup(() => {
    const engine = engineAccessor?.();
    if (textId !== null && engine) {
      engine.removeText(textId);
      textId = null;
    }
  });

  return null;
}
