import { FRAME_BUFFERS } from "./constants";

export class BufferManager {
  device: GPUDevice;
  renderBindGroupLayout: GPUBindGroupLayout;
  computeBindGroupLayout: GPUBindGroupLayout;

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

  allocate(instanceByteLength: number, globalUniformSize: number, velocityByteLength: number) {
    this.destroy();

    // velocity buffer
    this.velocityBuffer = this.device.createBuffer({
      size: Math.max(1, velocityByteLength),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    for (let i = 0; i < FRAME_BUFFERS; i += 1) {
      const globalUniformBuffer = this.device.createBuffer({
        size: globalUniformSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const instanceBuffer = this.device.createBuffer({
        size: Math.max(1, instanceByteLength),
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

  writeVelocities(velocityArrayBuffer: ArrayBuffer, byteLength: number) {
    if (byteLength > 0 && this.velocityBuffer) {
      this.device.queue.writeBuffer(this.velocityBuffer, 0, velocityArrayBuffer, 0, byteLength);
    }
  }

  destroy() {
    for (const b of this.instanceBuffers) {
      try { b.destroy(); } catch {}
    }
    for (const b of this.globalUniformBuffers) {
      try { b.destroy(); } catch {}
    }
    if (this.velocityBuffer) {
      try { this.velocityBuffer.destroy(); } catch {}
    }

    this.instanceBuffers = [];
    this.globalUniformBuffers = [];
    this.renderBindGroups = [];
    this.computeBindGroup = undefined;
  }
}

export default BufferManager;
