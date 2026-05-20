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

type PointerHandler = (event: SynapsePointerEvent) => void;

type NodeHandlers = {
  onClick?: PointerHandler;
  onPointerEnter?: PointerHandler;
  onPointerLeave?: PointerHandler;
};

interface RectNode extends BoxProps, NodeHandlers {
  id: number;
  kind: "rect";
  isHovered: boolean;
}

class SceneGraph {
  private nodes: RectNode[] = [];
  private indexById = new Map<number, number>();

  add(node: RectNode): number {
    const index = this.nodes.length;
    this.nodes.push(node);
    this.indexById.set(node.id, index);
    return index;
  }

  remove(id: number): { removedIndex: number; movedNode?: RectNode } | null {
    const index = this.indexById.get(id);
    if (index === undefined) {
      return null;
    }

    const lastIndex = this.nodes.length - 1;
    const removedIndex = index;
    let movedNode: RectNode | undefined;

    if (index !== lastIndex) {
      const tail = this.nodes[lastIndex];
      this.nodes[index] = tail;
      this.indexById.set(tail.id, index);
      movedNode = tail;
    }

    this.nodes.pop();
    this.indexById.delete(id);
    return { removedIndex, movedNode };
  }

  getById(id: number): RectNode | undefined {
    const index = this.indexById.get(id);
    if (index === undefined) {
      return undefined;
    }
    return this.nodes[index];
  }

  getIndex(id: number): number | undefined {
    return this.indexById.get(id);
  }

  all(): RectNode[] {
    return this.nodes;
  }

  count(): number {
    return this.nodes.length;
  }

  hitTest(x: number, y: number): RectNode | undefined {
    for (let i = this.nodes.length - 1; i >= 0; i -= 1) {
      const node = this.nodes[i];
      const withinX = x >= node.position.x && x <= node.position.x + node.size.x;
      const withinY = y >= node.position.y && y <= node.position.y + node.size.y;
      if (withinX && withinY) {
        return node;
      }
    }
    return undefined;
  }
}

const GLOBAL_UNIFORM_FLOATS = 4;
const GLOBAL_UNIFORM_SIZE = GLOBAL_UNIFORM_FLOATS * 4;
const INSTANCE_FLOATS = 8;
const INSTANCE_STRIDE = INSTANCE_FLOATS * 4;
const VELOCITY_FLOATS = 2;
const VELOCITY_STRIDE = VELOCITY_FLOATS * 4;
const FRAME_BUFFERS = 3;
const WORKGROUP_SIZE = 256;
const STATS_WINDOW = 120;

export class SynapseEngine {
  private adapter!: GPUAdapter;
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private pipeline!: GPURenderPipeline;
  private renderShaderModule!: GPUShaderModule;
  private computeShaderModule?: GPUShaderModule;
  private computePipeline?: GPUComputePipeline;
  private renderBindGroupLayout!: GPUBindGroupLayout;
  private computeBindGroupLayout!: GPUBindGroupLayout;
  private renderPipelineLayout!: GPUPipelineLayout;
  private computePipelineLayout!: GPUPipelineLayout;
  private globalUniformBuffers: GPUBuffer[] = [];
  private instanceBuffers: GPUBuffer[] = [];
  private velocityBuffer!: GPUBuffer;
  private renderBindGroups: GPUBindGroup[] = [];
  private computeBindGroup?: GPUBindGroup;
  private frameIndex = 0;
  private format: GPUTextureFormat = "bgra8unorm";

  private readonly scene = new SceneGraph();
  private readonly globalUniformData = new Float32Array(GLOBAL_UNIFORM_FLOATS);
  private instanceData = new Float32Array(0);
  private instanceCapacity = 0;
  private velocityData = new Float32Array(0);
  private velocityCount = 0;
  private nextId = 1;
  private hoveredId: number | null = null;
  private running = false;
  private needsRender = true;
  private canvasSize: Vec2 = { x: 1, y: 1 };
  private simulateOnGpu = false;
  private dirtyMin = -1;
  private dirtyMax = -1;
  private forceFullUpload = true;
  private continuousRender = false;
  private statsEnabled = false;
  private frameTimes: number[] = [];
  private frameTimeSum = 0;
  private frameTimeIndex = 0;
  private frameTimeCount = 0;
  private lastFrameStamp = 0;
  private lastFrameDelta = 0;
  private lastCpuMs = 0;
  private lastFps = 0;
  private lastDrawCalls = 0;
  private lastNodeCount = 0;

  private readonly onPointerMove = (event: PointerEvent): void => {
    this.handlePointerMove(event);
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.handlePointerDown(event);
  };

  private constructor(private canvas: HTMLCanvasElement) {
    this.canvas.style.touchAction = "none";
  }

  static async create(canvas: HTMLCanvasElement): Promise<SynapseEngine> {
    const engine = new SynapseEngine(canvas);
    await engine.init();
    return engine;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;

    const loop = (): void => {
      if (!this.running) {
        return;
      }
      this.render();
      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
  }

  destroy(): void {
    this.stop();
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.destroyBuffers();
  }

  enableStats(enabled: boolean): void {
    this.statsEnabled = enabled;
    if (!enabled) {
      this.frameTimes = [];
      this.frameTimeSum = 0;
      this.frameTimeIndex = 0;
      this.frameTimeCount = 0;
      this.lastFrameStamp = 0;
      this.lastFrameDelta = 0;
      this.lastCpuMs = 0;
      this.lastFps = 0;
      this.lastDrawCalls = 0;
      this.lastNodeCount = 0;
    }
  }

  getFrameStats(): SynapseFrameStats {
    return {
      fps: this.lastFps,
      frameMs: this.lastFrameDelta,
      cpuMs: this.lastCpuMs,
      drawCalls: this.lastDrawCalls,
      nodeCount: this.lastNodeCount,
    };
  }

  getCanvasSize(): Vec2 {
    return { x: this.canvasSize.x, y: this.canvasSize.y };
  }

  setContinuousRender(enabled: boolean): void {
    this.continuousRender = enabled;
    if (enabled) {
      this.invalidate();
    }
  }

  enableGpuSimulation(enabled: boolean, velocities?: Vec2[]): boolean {
    if (!enabled) {
      this.simulateOnGpu = false;
      this.markAllDirty(this.scene.count());
      this.invalidate();
      return false;
    }

    if (!this.computePipeline) {
      if (!this.computeShaderModule) {
        this.simulateOnGpu = false;
        this.instanceDirty = true;
        this.invalidate();
        return false;
      }

      try {
        this.computePipeline = this.device.createComputePipeline({
          layout: this.computePipelineLayout,
          compute: {
            module: this.computeShaderModule,
            entryPoint: "cs_update",
          },
        });
      } catch {
        this.simulateOnGpu = false;
        this.instanceDirty = true;
        this.invalidate();
        return false;
      }
    }

    if (!this.computePipeline || !this.computeBindGroup) {
      this.simulateOnGpu = false;
      this.markAllDirty(this.scene.count());
      this.invalidate();
      return false;
    }

    this.simulateOnGpu = true;
    this.markAllDirty(this.scene.count());
    if (velocities) {
      this.setVelocities(velocities);
    }

    this.invalidate();
    return true;
  }

  setVelocities(velocities: Vec2[]): void {
    this.velocityCount = velocities.length;
    this.ensureInstanceCapacity(velocities.length);

    for (let i = 0; i < velocities.length; i += 1) {
      const offset = i * VELOCITY_FLOATS;
      this.velocityData[offset] = velocities[i].x;
      this.velocityData[offset + 1] = velocities[i].y;
    }

    const byteLength = velocities.length * VELOCITY_STRIDE;
    if (byteLength > 0) {
      this.device.queue.writeBuffer(
        this.velocityBuffer,
        0,
        this.velocityData.buffer,
        0,
        byteLength
      );
    }
  }

  createBox(props: BoxProps): SynapseBox {
    const id = this.nextId;
    this.nextId += 1;

    const node: RectNode = {
      id,
      kind: "rect",
      position: props.position,
      size: props.size,
      color: props.color,
      hoverColor: props.hoverColor,
      isHovered: false,
    };

    const index = this.scene.add(node);
    this.ensureInstanceCapacity(this.scene.count(), this.scene.all());
    this.writeInstanceAt(index, node);
    this.markDirty(index);
    this.invalidate();
    return new SynapseBox(this, id);
  }

  updateBox(id: number, updates: Partial<BoxProps>): void {
    const node = this.scene.getById(id);
    const index = this.scene.getIndex(id);
    if (!node) {
      return;
    }

    if (index === undefined) {
      return;
    }

    if (updates.position) {
      node.position = updates.position;
    }

    if (updates.size) {
      node.size = updates.size;
    }

    if (updates.color) {
      node.color = updates.color;
    }

    if ("hoverColor" in updates) {
      node.hoverColor = updates.hoverColor;
    }

    this.writeInstanceAt(index, node);
    this.markDirty(index);
    this.invalidate();
  }

  setNodeHandlers(id: number, handlers: NodeHandlers): void {
    const node = this.scene.getById(id);
    if (!node) {
      return;
    }

    if ("onClick" in handlers) {
      node.onClick = handlers.onClick;
    }

    if ("onPointerEnter" in handlers) {
      node.onPointerEnter = handlers.onPointerEnter;
    }

    if ("onPointerLeave" in handlers) {
      node.onPointerLeave = handlers.onPointerLeave;
    }
  }

  removeNode(id: number): void {
    const result = this.scene.remove(id);
    if (!result) {
      return;
    }
    if (this.hoveredId === id) {
      this.hoveredId = null;
    }

    if (result.movedNode) {
      this.writeInstanceAt(result.removedIndex, result.movedNode);
      this.markDirty(result.removedIndex);
    }

    this.invalidate();
  }

  invalidate(): void {
    this.needsRender = true;
  }

  private async init(): Promise<void> {
    if (!navigator.gpu) {
      throw new Error("WebGPU is not available in this browser.");
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("WebGPU adapter request failed.");
    }

    const device = await adapter.requestDevice();
    const context = this.canvas.getContext("webgpu");
    if (!context) {
      throw new Error("WebGPU canvas context unavailable.");
    }

    this.adapter = adapter;
    this.device = device;
    this.context = context;
    this.format = navigator.gpu.getPreferredCanvasFormat();

    this.resizeToDisplaySize();
    this.configureContext();

    const renderSource = await this.loadShaderSource("ui.wgsl");
    const renderModule = device.createShaderModule({ code: renderSource });
    this.renderShaderModule = renderModule;

    const computeSource = await this.loadShaderSource("sim.wgsl");
    this.computeShaderModule = device.createShaderModule({ code: computeSource });

    this.renderBindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "uniform" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "read-only-storage" },
        },
      ],
    });

    this.computeBindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" },
        },
      ],
    });

    this.renderPipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [this.renderBindGroupLayout],
    });

    this.computePipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [this.computeBindGroupLayout],
    });

    this.pipeline = device.createRenderPipeline({
      layout: this.renderPipelineLayout,
      vertex: {
        module: renderModule,
        entryPoint: "vs",
      },
      fragment: {
        module: renderModule,
        entryPoint: "fs",
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
    });

    this.allocateBuffers(1);

    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
  }

  private async loadShaderSource(fileName: string): Promise<string> {
    const url = new URL(`./${fileName}`, import.meta.url);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load WGSL shader: ${response.status} ${response.statusText}`);
    }
    return response.text();
  }

  private configureContext(): void {
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "premultiplied",
    });
  }

  private resizeToDisplaySize(): void {
    const dpr = window.devicePixelRatio || 1;
    const clientWidth = Math.max(1, Math.floor(this.canvas.clientWidth || this.canvas.width));
    const clientHeight = Math.max(1, Math.floor(this.canvas.clientHeight || this.canvas.height));
    const width = Math.max(1, Math.floor(clientWidth * dpr));
    const height = Math.max(1, Math.floor(clientHeight * dpr));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.canvasSize = { x: width, y: height };
      this.configureContext();
      this.invalidate();
    }
  }

  private render(): void {
    this.resizeToDisplaySize();
    if (!this.needsRender && !this.simulateOnGpu && !this.continuousRender) {
      return;
    }

    const frameStart = this.statsEnabled ? performance.now() : 0;
    const nodes = this.scene.all();
    this.ensureInstanceCapacity(nodes.length, nodes);
    const frameSlot = this.simulateOnGpu ? 0 : this.frameIndex;

    const view = this.context.getCurrentTexture().createView();
    const encoder = this.device.createCommandEncoder();
    this.writeGlobalUniforms(nodes.length, frameSlot);

    this.flushInstanceData(nodes, frameSlot);
    if (this.simulateOnGpu) {
      this.dispatchCompute(encoder, nodes.length, frameSlot);
    }

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0.05, g: 0.05, b: 0.07, a: 1.0 },
        },
      ],
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.renderBindGroups[frameSlot]);

    if (nodes.length > 0) {
      pass.draw(6, nodes.length, 0, 0);
    }

    pass.end();
    this.device.queue.submit([encoder.finish()]);
    this.needsRender = false;
    if (!this.simulateOnGpu) {
      this.frameIndex = (this.frameIndex + 1) % FRAME_BUFFERS;
    }

    if (this.statsEnabled) {
      const frameEnd = performance.now();
      this.lastCpuMs = frameEnd - frameStart;
      this.lastDrawCalls = nodes.length > 0 ? 1 : 0;
      this.lastNodeCount = nodes.length;
      this.recordFrame(frameStart);
    }
  }

  private writeGlobalUniforms(nodeCount: number, frameSlot: number): void {
    this.globalUniformData[0] = this.canvasSize.x;
    this.globalUniformData[1] = this.canvasSize.y;
    this.globalUniformData[2] = nodeCount;
    this.globalUniformData[3] = 0;

    this.device.queue.writeBuffer(
      this.globalUniformBuffers[frameSlot],
      0,
      this.globalUniformData
    );
  }

  private markDirty(index: number): void {
    if (this.dirtyMin === -1 || index < this.dirtyMin) {
      this.dirtyMin = index;
    }
    if (this.dirtyMax === -1 || index > this.dirtyMax) {
      this.dirtyMax = index;
    }
  }

  private markAllDirty(count: number): void {
    if (count <= 0) {
      this.dirtyMin = -1;
      this.dirtyMax = -1;
      return;
    }
    this.dirtyMin = 0;
    this.dirtyMax = count - 1;
  }

  private clearDirty(): void {
    this.dirtyMin = -1;
    this.dirtyMax = -1;
  }

  private writeInstanceAt(index: number, node: RectNode): void {
    const color = node.isHovered && node.hoverColor ? node.hoverColor : node.color;
    const offset = index * INSTANCE_FLOATS;

    this.instanceData[offset] = node.position.x;
    this.instanceData[offset + 1] = node.position.y;
    this.instanceData[offset + 2] = node.size.x;
    this.instanceData[offset + 3] = node.size.y;
    this.instanceData[offset + 4] = color.r;
    this.instanceData[offset + 5] = color.g;
    this.instanceData[offset + 6] = color.b;
    this.instanceData[offset + 7] = color.a;
  }

  private rebuildInstanceData(nodes: RectNode[]): void {
    for (let i = 0; i < nodes.length; i += 1) {
      this.writeInstanceAt(i, nodes[i]);
    }
  }

  private flushInstanceData(nodes: RectNode[], frameSlot: number): void {
    if (nodes.length === 0) {
      this.clearDirty();
      return;
    }

    if (this.forceFullUpload) {
      this.rebuildInstanceData(nodes);
      this.markAllDirty(nodes.length);
      this.forceFullUpload = false;
    }

    if (this.dirtyMin === -1) {
      return;
    }

    const startIndex = this.dirtyMin;
    const endIndex = this.dirtyMax;
    const start = startIndex * INSTANCE_FLOATS;
    const end = (endIndex + 1) * INSTANCE_FLOATS;
    const slice = this.instanceData.subarray(start, end);

    // State-to-GPU path: framework state -> setters -> scene graph mutation
    // -> pack dirty range -> queue.writeBuffer -> one instanced draw.
    this.device.queue.writeBuffer(
      this.instanceBuffers[frameSlot],
      startIndex * INSTANCE_STRIDE,
      slice
    );

    this.clearDirty();
  }

  private dispatchCompute(
    encoder: GPUCommandEncoder,
    nodeCount: number,
    frameSlot: number
  ): void {
    if (!this.computePipeline || nodeCount === 0) {
      return;
    }

    const pass = encoder.beginComputePass();
    pass.setPipeline(this.computePipeline);
    if (!this.computeBindGroup) {
      pass.end();
      return;
    }
    pass.setBindGroup(0, this.computeBindGroup);
    const workgroups = Math.ceil(nodeCount / WORKGROUP_SIZE);
    pass.dispatchWorkgroups(workgroups);
    pass.end();
  }

  private ensureInstanceCapacity(required: number): void {
    if (required <= this.instanceCapacity) {
      return;
    }

    const nextCapacity = Math.max(required, this.instanceCapacity * 2, 1);
    this.allocateBuffers(nextCapacity);
  }

  private destroyBuffers(): void {
    for (const buffer of this.instanceBuffers) {
      buffer.destroy();
    }

    for (const buffer of this.globalUniformBuffers) {
      buffer.destroy();
    }

    if (this.velocityBuffer) {
      this.velocityBuffer.destroy();
    }

    this.instanceBuffers = [];
    this.globalUniformBuffers = [];
    this.renderBindGroups = [];
    this.computeBindGroup = undefined;
  }

  private allocateBuffers(instanceCapacity: number): void {
    const previousVelocityData = this.velocityData;
    this.destroyBuffers();

    this.instanceCapacity = instanceCapacity;
    this.instanceData = new Float32Array(this.instanceCapacity * INSTANCE_FLOATS);
    this.velocityData = new Float32Array(this.instanceCapacity * VELOCITY_FLOATS);
    if (previousVelocityData.length > 0) {
      this.velocityData.set(
        previousVelocityData.subarray(
          0,
          Math.min(previousVelocityData.length, this.velocityData.length)
        )
      );
    }

    this.velocityBuffer = this.device.createBuffer({
      size: this.velocityData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    for (let i = 0; i < FRAME_BUFFERS; i += 1) {
      const globalUniformBuffer = this.device.createBuffer({
        size: GLOBAL_UNIFORM_SIZE,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const instanceBuffer = this.device.createBuffer({
        size: this.instanceData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });

      const renderBindGroup = this.device.createBindGroup({
        layout: this.renderBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: globalUniformBuffer },
          },
          {
            binding: 1,
            resource: { buffer: instanceBuffer },
          },
        ],
      });

      this.globalUniformBuffers.push(globalUniformBuffer);
      this.instanceBuffers.push(instanceBuffer);
      this.renderBindGroups.push(renderBindGroup);
    }

    this.computeBindGroup = this.device.createBindGroup({
      layout: this.computeBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.globalUniformBuffers[0] },
        },
        {
          binding: 1,
          resource: { buffer: this.instanceBuffers[0] },
        },
        {
          binding: 2,
          resource: { buffer: this.velocityBuffer },
        },
      ],
    });

    if (this.velocityCount > 0) {
      const byteLength = this.velocityCount * VELOCITY_STRIDE;
      this.device.queue.writeBuffer(this.velocityBuffer, 0, this.velocityData.buffer, 0, byteLength);
    }

    this.frameIndex = 0;
  }

  private recordFrame(frameStamp: number): void {
    if (this.lastFrameStamp > 0) {
      const delta = frameStamp - this.lastFrameStamp;
      if (delta > 0) {
        this.lastFrameDelta = delta;
        if (this.frameTimeCount < STATS_WINDOW) {
          this.frameTimes.push(delta);
          this.frameTimeSum += delta;
          this.frameTimeCount += 1;
        } else {
          const index = this.frameTimeIndex % STATS_WINDOW;
          this.frameTimeSum += delta - this.frameTimes[index];
          this.frameTimes[index] = delta;
          this.frameTimeIndex += 1;
        }
        const average = this.frameTimeSum / this.frameTimeCount;
        this.lastFps = average > 0 ? 1000 / average : 0;
      }
    }

    this.lastFrameStamp = frameStamp;
  }

  private handlePointerMove(event: PointerEvent): void {
    const point = this.toCanvasSpace(event);
    const hit = this.scene.hitTest(point.x, point.y);
    const hitId = hit ? hit.id : null;

    if (hitId === this.hoveredId) {
      return;
    }

    if (this.hoveredId !== null) {
      const previous = this.scene.getById(this.hoveredId);
      if (previous) {
        previous.isHovered = false;
        previous.onPointerLeave?.({ x: point.x, y: point.y, nodeId: previous.id });
        this.instanceDirty = true;
      }
    }

    if (hit) {
      hit.isHovered = true;
      hit.onPointerEnter?.({ x: point.x, y: point.y, nodeId: hit.id });
      this.instanceDirty = true;
    }

    this.hoveredId = hitId;
    this.invalidate();
  }

  private handlePointerDown(event: PointerEvent): void {
    const point = this.toCanvasSpace(event);
    const hit = this.scene.hitTest(point.x, point.y);
    if (hit) {
      hit.onClick?.({ x: point.x, y: point.y, nodeId: hit.id });
    }
  }

  private toCanvasSpace(event: PointerEvent): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }
}

export class SynapseBox {
  constructor(private engine: SynapseEngine, public readonly id: number) {}

  setPosition(position: Vec2): void {
    this.engine.updateBox(this.id, { position });
  }

  setSize(size: Vec2): void {
    this.engine.updateBox(this.id, { size });
  }

  setColor(color: Color4): void {
    this.engine.updateBox(this.id, { color });
  }

  setHoverColor(hoverColor?: Color4): void {
    this.engine.updateBox(this.id, { hoverColor });
  }

  onClick(handler?: PointerHandler): void {
    this.engine.setNodeHandlers(this.id, { onClick: handler });
  }

  onPointerEnter(handler?: PointerHandler): void {
    this.engine.setNodeHandlers(this.id, { onPointerEnter: handler });
  }

  onPointerLeave(handler?: PointerHandler): void {
    this.engine.setNodeHandlers(this.id, { onPointerLeave: handler });
  }

  destroy(): void {
    this.engine.removeNode(this.id);
  }
}
