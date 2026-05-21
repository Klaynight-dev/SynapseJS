import type { Color4, Vec2 } from "./types";

export const ZERO_COLOR: Color4 = { r: 0, g: 0, b: 0, a: 0 };
export const ZERO_VEC2: Vec2 = { x: 0, y: 0 };

export const GLOBAL_UNIFORM_FLOATS = 4;
export const GLOBAL_UNIFORM_SIZE = GLOBAL_UNIFORM_FLOATS * 4;
export const INSTANCE_FLOATS = 24;
export const INSTANCE_STRIDE = INSTANCE_FLOATS * 4;
export const VELOCITY_FLOATS = 2;
export const VELOCITY_STRIDE = VELOCITY_FLOATS * 4;
export const FRAME_BUFFERS = 3;
export const WORKGROUP_SIZE = 256;
export const STATS_WINDOW = 120;
