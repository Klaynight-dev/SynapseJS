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
      .catch((error) => {
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
    });

    boxRef.current = box;

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

    // React state -> props -> Synapse setters -> scene graph mutation.
    // On the next render pass, Synapse packs all instances into a storage
    // buffer and issues a single instanced draw call.
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
