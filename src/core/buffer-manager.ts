import { FRAME_BUFFERS } from "./constants";

export class BufferManager {
  private device: GPUDevice;
  private renderBindGroupLayout: GPUBindGroupLayout;
  private computeBindGroupLayout: GPUBindGroupLayout;

  globalUniformBuffers: GPUBuffer[] = [];
  instanceBuffers: GPUBuffer[] = [];
  velocityBuffer!: GPUBuffer;
  renderBindGroups: GPUBindGroup[] = [];
  computeBindGroup?: GPUBindGroup;

  constructor(device: GPUDevice, renderBindGroupLayout: GPUBindGroupLayout, computeBindGroupLayout: GPUBindGroupLayout) {
    this.device = device;
    this.renderBindGroupLayout = renderBindGroupLayout;
    this.computeBindGroupLayout = computeBindGroupLayout;
  }

  allocate(instanceByteLength: number, globalUniformSize: number, velocityByteLength: number): void {
    this.destroy();

    const maxBufferSize = this.device.limits.maxBufferSize;
    const maxStorageSize = this.device.limits.maxStorageBufferBindingSize;

    const instanceSize = Math.max(1, instanceByteLength);
    const velocitySize = Math.max(1, velocityByteLength);

    if (instanceSize > maxBufferSize || instanceSize > maxStorageSize) {
      throw new Error(
        `Instance buffer size (${instanceSize} bytes) exceeds device limits ` +
        `(maxBufferSize=${maxBufferSize}, maxStorageBufferBindingSize=${maxStorageSize})`
      );
    }

    if (velocitySize > maxBufferSize || velocitySize > maxStorageSize) {
      throw new Error(
        `Velocity buffer size (${velocitySize} bytes) exceeds device limits ` +
        `(maxBufferSize=${maxBufferSize}, maxStorageBufferBindingSize=${maxStorageSize})`
      );
    }

    this.velocityBuffer = this.device.createBuffer({
      size: velocitySize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    for (let i = 0; i < FRAME_BUFFERS; i += 1) {
      const globalUniformBuffer = this.device.createBuffer({
        size: globalUniformSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const instanceBuffer = this.device.createBuffer({
        size: instanceSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });

      const renderBindGroup = this.device.createBindGroup({
        layout: this.renderBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: globalUniformBuffer } },
          { binding: 1, resource: { buffer: instanceBuffer } },
        ],
      });

      this.globalUniformBuffers.push(globalUniformBuffer);
      this.instanceBuffers.push(instanceBuffer);
      this.renderBindGroups.push(renderBindGroup);
    }

    this.computeBindGroup = this.device.createBindGroup({
      layout: this.computeBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.globalUniformBuffers[0] } },
        { binding: 1, resource: { buffer: this.instanceBuffers[0] } },
        { binding: 2, resource: { buffer: this.velocityBuffer } },
      ],
    });
  }

  writeVelocities(velocityArrayBuffer: ArrayBuffer, byteLength: number): void {
    if (byteLength > 0 && this.velocityBuffer) {
      this.device.queue.writeBuffer(this.velocityBuffer, 0, velocityArrayBuffer, 0, byteLength);
    }
  }

  destroy(): void {
    for (const b of this.instanceBuffers) {
      this.safeDestroyBuffer(b);
    }
    for (const b of this.globalUniformBuffers) {
      this.safeDestroyBuffer(b);
    }
    if (this.velocityBuffer) {
      this.safeDestroyBuffer(this.velocityBuffer);
    }

    this.instanceBuffers = [];
    this.globalUniformBuffers = [];
    this.renderBindGroups = [];
    this.computeBindGroup = undefined;
  }

  private safeDestroyBuffer(buffer: GPUBuffer): void {
    try {
      buffer.destroy();
    } catch (error) {
      console.warn("Failed to destroy GPU buffer:", error);
    }
  }
}

export default BufferManager;
