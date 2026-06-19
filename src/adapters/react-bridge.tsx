import * as React from "react";
import {
  BoxProps,
  SynapseBox,
  SynapseEngine,
  SynapsePointerEvent,
} from "../core";

type SynapseCanvasProps = {
  width: number;
  height: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

const EngineContext = React.createContext<SynapseEngine | null>(null);

export function useEngine(): SynapseEngine | null {
  return React.useContext(EngineContext);
}

export function SynapseCanvas(props: SynapseCanvasProps): JSX.Element {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const engineRef = React.useRef<SynapseEngine | null>(null);
  const [engine, setEngine] = React.useState<SynapseEngine | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    let cancelled = false;
    SynapseEngine.create(canvas)
      .then((created) => {
        if (cancelled) {
          return;
        }
        engineRef.current = created;
        created.start();
        setEngine(created);
      })
      .catch((error: unknown) => {
        console.error("Synapse engine failed to initialize:", error);
      });

    return () => {
      cancelled = true;
      engineRef.current?.destroy();
      engineRef.current = null;
      setEngine(null);
    };
  }, []);

  return (
    <EngineContext.Provider value={engine}>
      <canvas
        ref={canvasRef}
        className={props.className}
        style={{
          width: `${props.width}px`,
          height: `${props.height}px`,
          display: "block",
          ...(props.style ?? {}),
        }}
      />
      {engine ? props.children : null}
    </EngineContext.Provider>
  );
}

export type SynapseRectProps = BoxProps & {
  onClick?: (event: SynapsePointerEvent) => void;
  onPointerEnter?: (event: SynapsePointerEvent) => void;
  onPointerLeave?: (event: SynapsePointerEvent) => void;
};

export function SynapseRect(props: SynapseRectProps): null {
  const engine = React.useContext(EngineContext);
  const boxRef = React.useRef<SynapseBox | null>(null);
  const prevPropsRef = React.useRef<Partial<BoxProps>>({});

  React.useEffect(() => {
    if (!engine) {
      return undefined;
    }

    const box = engine.createBox({
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

    boxRef.current = box;
    prevPropsRef.current = {
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
    };

    return () => {
      box.destroy();
      boxRef.current = null;
    };
  }, [engine]);

  React.useEffect(() => {
    const box = boxRef.current;
    if (!box) {
      return;
    }

    const prev = prevPropsRef.current;
    const delta: Partial<BoxProps> = {};
    let changed = false;

    if (props.position !== prev.position) { delta.position = props.position; changed = true; }
    if (props.size !== prev.size) { delta.size = props.size; changed = true; }
    if (props.color !== prev.color) { delta.color = props.color; changed = true; }
    if (props.hoverColor !== prev.hoverColor) { delta.hoverColor = props.hoverColor; changed = true; }
    if (props.radius !== prev.radius) { delta.radius = props.radius; changed = true; }
    if (props.softness !== prev.softness) { delta.softness = props.softness; changed = true; }
    if (props.gradientColor !== prev.gradientColor) { delta.gradientColor = props.gradientColor; changed = true; }
    if (props.gradientMix !== prev.gradientMix) { delta.gradientMix = props.gradientMix; changed = true; }
    if (props.shadowColor !== prev.shadowColor) { delta.shadowColor = props.shadowColor; changed = true; }
    if (props.shadowOffset !== prev.shadowOffset) { delta.shadowOffset = props.shadowOffset; changed = true; }
    if (props.shadowBlur !== prev.shadowBlur) { delta.shadowBlur = props.shadowBlur; changed = true; }
    if (props.shadowSpread !== prev.shadowSpread) { delta.shadowSpread = props.shadowSpread; changed = true; }

    if (changed) {
      box.update(delta);
      prevPropsRef.current = {
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
      };
    }
  }, [
    props.position,
    props.size,
    props.color,
    props.hoverColor,
    props.radius,
    props.softness,
    props.gradientColor,
    props.gradientMix,
    props.shadowColor,
    props.shadowOffset,
    props.shadowBlur,
    props.shadowSpread,
  ]);

  React.useEffect(() => {
    const box = boxRef.current;
    if (!box) {
      return;
    }

    box.onClick(props.onClick);
    box.onPointerEnter(props.onPointerEnter);
    box.onPointerLeave(props.onPointerLeave);
  }, [props.onClick, props.onPointerEnter, props.onPointerLeave]);

  return null;
}

export type SynapseTextProps = {
  position: { x: number; y: number };
  text: string;
  fontSize: number;
  color: { r: number; g: number; b: number; a: number };
};

export function SynapseText(props: SynapseTextProps): null {
  const engine = React.useContext(EngineContext);
  const textIdRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!engine) return undefined;

    const initText = async () => {
      await engine.initTextRenderer(props.fontSize);
      const id = engine.addText({
        position: props.position,
        text: props.text,
        fontSize: props.fontSize,
        color: props.color,
      });
      textIdRef.current = id;
    };

    initText();

    return () => {
      if (textIdRef.current !== null) {
        engine.removeText(textIdRef.current);
        textIdRef.current = null;
      }
    };
  }, [engine]);

  React.useEffect(() => {
    if (textIdRef.current === null) return;
    engine?.updateText(textIdRef.current, {
      position: props.position,
      text: props.text,
      fontSize: props.fontSize,
      color: props.color,
    });
  }, [props.position, props.text, props.fontSize, props.color]);

  return null;
}
