import { describe, it, expect, vi, beforeEach } from "vitest";
import { BufferPool } from "../buffer-pool";

function createMockDevice(): GPUDevice {
  let bufferId = 0;
  return {
    createBuffer: vi.fn((descriptor: GPUBufferDescriptor) => ({
      id: ++bufferId,
      size: descriptor.size,
      usage: descriptor.usage,
      destroy: vi.fn(),
      mapAsync: vi.fn(),
      unmap: vi.fn(),
      getMappedRange: vi.fn(),
      label: "",
      mapState: "unmapped" as GPUBufferMapState,
    })),
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
    },
  } as unknown as GPUDevice;
}

describe("BufferPool", () => {
  let device: GPUDevice;

  beforeEach(() => {
    device = createMockDevice();
  });

  it("creates a new buffer on first acquire", () => {
    const pool = new BufferPool(device, 0x80 | 0x8);
    const buffer = pool.acquire(100);

    expect(buffer).toBeDefined();
    expect(device.createBuffer).toHaveBeenCalledOnce();
  });

  it("reuses released buffers of the same size", () => {
    const pool = new BufferPool(device, 0x80 | 0x8);
    const buffer1 = pool.acquire(100);
    pool.release(buffer1);
    const buffer2 = pool.acquire(100);

    expect(buffer2).toBe(buffer1);
    expect(device.createBuffer).toHaveBeenCalledTimes(1);
  });

  it("creates new buffer when all same-size buffers are in use", () => {
    const pool = new BufferPool(device, 0x80 | 0x8);
    pool.acquire(100);
    pool.acquire(100);

    expect(device.createBuffer).toHaveBeenCalledTimes(2);
  });

  it("aligns buffer sizes to 256 bytes", () => {
    const pool = new BufferPool(device, 0x80 | 0x8);
    pool.acquire(100);

    expect(device.createBuffer).toHaveBeenCalledWith(
      expect.objectContaining({ size: 256 })
    );
  });

  it("reports stats correctly", () => {
    const pool = new BufferPool(device, 0x80 | 0x8);
    const b1 = pool.acquire(100);
    pool.acquire(200);

    let stats = pool.getStats();
    expect(stats.totalBuffers).toBe(2);
    expect(stats.inUse).toBe(2);

    pool.release(b1);
    stats = pool.getStats();
    expect(stats.inUse).toBe(1);
  });

  it("destroys all buffers on destroy()", () => {
    const pool = new BufferPool(device, 0x80 | 0x8);
    const b1 = pool.acquire(100);
    const b2 = pool.acquire(200);
    pool.destroy();

    expect((b1 as any).destroy).toHaveBeenCalled();
    expect((b2 as any).destroy).toHaveBeenCalled();
    expect(pool.getStats().totalBuffers).toBe(0);
  });
});
