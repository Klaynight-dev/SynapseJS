export type Vec2 = {
  x: number;
  y: number;
};

export type Color4 = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export interface BoxProps {
  position: Vec2;
  size: Vec2;
  color: Color4;
  hoverColor?: Color4;
  radius?: number;
  softness?: number;
  gradientColor?: Color4;
  gradientMix?: number;
  shadowColor?: Color4;
  shadowOffset?: Vec2;
  shadowBlur?: number;
  shadowSpread?: number;
}

export interface SynapsePointerEvent {
  x: number;
  y: number;
  nodeId: number;
}

export type SynapseFrameStats = {
  fps: number;
  frameMs: number;
  cpuMs: number;
  drawCalls: number;
  nodeCount: number;
};

export type PointerHandler = (event: SynapsePointerEvent) => void;

export type NodeHandlers = {
  onClick?: PointerHandler;
  onPointerEnter?: PointerHandler;
  onPointerLeave?: PointerHandler;
};
