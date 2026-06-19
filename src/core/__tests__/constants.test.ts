import { describe, it, expect } from "vitest";
import {
  GLOBAL_UNIFORM_FLOATS,
  GLOBAL_UNIFORM_SIZE,
  INSTANCE_FLOATS,
  INSTANCE_STRIDE,
  VELOCITY_FLOATS,
  VELOCITY_STRIDE,
  FRAME_BUFFERS,
  WORKGROUP_SIZE,
} from "../constants";

describe("constants", () => {
  it("GLOBAL_UNIFORM_SIZE is GLOBAL_UNIFORM_FLOATS * 4", () => {
    expect(GLOBAL_UNIFORM_SIZE).toBe(GLOBAL_UNIFORM_FLOATS * 4);
  });

  it("INSTANCE_STRIDE is INSTANCE_FLOATS * 4", () => {
    expect(INSTANCE_STRIDE).toBe(INSTANCE_FLOATS * 4);
  });

  it("VELOCITY_STRIDE is VELOCITY_FLOATS * 4", () => {
    expect(VELOCITY_STRIDE).toBe(VELOCITY_FLOATS * 4);
  });

  it("INSTANCE_FLOATS matches shader struct (6 vec4 = 24 floats)", () => {
    expect(INSTANCE_FLOATS).toBe(24);
  });

  it("FRAME_BUFFERS is at least 2 for double buffering", () => {
    expect(FRAME_BUFFERS).toBeGreaterThanOrEqual(2);
  });

  it("WORKGROUP_SIZE is a power of 2", () => {
    expect(WORKGROUP_SIZE).toBeGreaterThan(0);
    expect(WORKGROUP_SIZE & (WORKGROUP_SIZE - 1)).toBe(0);
  });
});
