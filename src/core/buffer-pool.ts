interface PooledBuffer {
  buffer: GPUBuffer;
  size: number;
  inUse: boolean;
}

export class BufferPool {
  private device: GPUDevice;
  private pools = new Map<number, PooledBuffer[]>();
  private defaultUsage: GPUBufferUsageFlags;

  constructor(device: GPUDevice, defaultUsage: GPUBufferUsageFlags) {
    this.device = device;
    this.defaultUsage = defaultUsage;
  }

  acquire(requestedSize: number, usage?: GPUBufferUsageFlags): GPUBuffer {
    const size = this.alignSize(requestedSize);
    const pool = this.pools.get(size);

    if (pool) {
      for (const entry of pool) {
        if (!entry.inUse) {
          entry.inUse = true;
          return entry.buffer;
        }
      }
    }

    const buffer = this.device.createBuffer({
      size,
      usage: usage ?? this.defaultUsage,
    });

    const entry: PooledBuffer = { buffer, size, inUse: true };

    if (!this.pools.has(size)) {
      this.pools.set(size, []);
    }
    this.pools.get(size)!.push(entry);

    return buffer;
  }

  release(buffer: GPUBuffer): void {
    for (const pool of this.pools.values()) {
      for (const entry of pool) {
        if (entry.buffer === buffer) {
          entry.inUse = false;
          return;
        }
      }
    }
  }

  destroy(): void {
    for (const pool of this.pools.values()) {
      for (const entry of pool) {
        try {
          entry.buffer.destroy();
        } catch (error) {
          console.warn("Failed to destroy pooled buffer:", error);
        }
      }
    }
    this.pools.clear();
  }

  getStats(): { totalBuffers: number; inUse: number; totalBytes: number } {
    let totalBuffers = 0;
    let inUse = 0;
    let totalBytes = 0;

    for (const pool of this.pools.values()) {
      for (const entry of pool) {
        totalBuffers++;
        totalBytes += entry.size;
        if (entry.inUse) {
          inUse++;
        }
      }
    }

    return { totalBuffers, inUse, totalBytes };
  }

  private alignSize(size: number): number {
    const alignment = 256;
    return Math.ceil(Math.max(size, 1) / alignment) * alignment;
  }
}
