import type { Color4, FontAtlas, Vec2 } from "./types";
import { ShaderStage } from "./flags";

const TEXT_GLYPH_FLOATS = 12;
const TEXT_GLYPH_STRIDE = TEXT_GLYPH_FLOATS * 4;

interface TextEntry {
  id: number;
  position: Vec2;
  text: string;
  fontSize: number;
  color: Color4;
}

export class TextRenderer {
  private device: GPUDevice;
  private pipeline!: GPURenderPipeline;
  private bindGroupLayout!: GPUBindGroupLayout;
  private bindGroup!: GPUBindGroup;
  private glyphBuffer!: GPUBuffer;
  private uniformBuffer!: GPUBuffer;
  private fontTexture!: GPUTexture;
  private fontSampler!: GPUSampler;
  private atlas!: FontAtlas;

  private entries: TextEntry[] = [];
  private entryMap = new Map<number, TextEntry>();
  private glyphData = new Float32Array(0);
  private glyphCount = 0;
  private glyphCapacity = 0;
  private nextId = 1;
  private dirty = true;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  async init(format: GPUTextureFormat, atlas: FontAtlas): Promise<void> {
    this.atlas = atlas;

    this.fontTexture = this.device.createTexture({
      size: { width: atlas.atlasWidth, height: atlas.atlasHeight },
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.device.queue.copyExternalImageToTexture(
      { source: atlas.texture },
      { texture: this.fontTexture },
      { width: atlas.atlasWidth, height: atlas.atlasHeight }
    );

    this.fontSampler = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    });

    const shaderSource = await this.loadShader();
    const shaderModule = this.device.createShaderModule({ code: shaderSource });

    this.bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: ShaderStage.VERTEX, buffer: { type: "uniform" } },
        { binding: 1, visibility: ShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: ShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 3, visibility: ShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      ],
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroupLayout],
    });

    this.pipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module: shaderModule, entryPoint: "vs" },
      fragment: {
        module: shaderModule,
        entryPoint: "fs",
        targets: [{
          format,
          blend: {
            color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
            alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
          },
        }],
      },
      primitive: { topology: "triangle-list", cullMode: "none" },
    });

    this.uniformBuffer = this.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.allocateGlyphBuffer(256);
  }

  addText(position: Vec2, text: string, fontSize: number, color: Color4): number {
    const id = this.nextId++;
    const entry: TextEntry = { id, position, text, fontSize, color };
    this.entries.push(entry);
    this.entryMap.set(id, entry);
    this.dirty = true;
    return id;
  }

  updateText(id: number, updates: Partial<Omit<TextEntry, "id">>): void {
    const entry = this.entryMap.get(id);
    if (!entry) return;

    if (updates.position) entry.position = updates.position;
    if (updates.text !== undefined) entry.text = updates.text;
    if (updates.fontSize !== undefined) entry.fontSize = updates.fontSize;
    if (updates.color) entry.color = updates.color;
    this.dirty = true;
  }

  removeText(id: number): void {
    if (!this.entryMap.has(id)) return;
    this.entryMap.delete(id);
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx !== -1) {
      this.entries.splice(idx, 1);
    }
    this.dirty = true;
  }

  render(pass: GPURenderPassEncoder, canvasWidth: number, canvasHeight: number): void {
    if (this.entries.length === 0) return;

    if (this.dirty) {
      this.rebuildGlyphs();
      this.dirty = false;
    }

    if (this.glyphCount === 0) return;

    const uniformData = new Float32Array([canvasWidth, canvasHeight, 0, 0]);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(6, this.glyphCount, 0, 0);
  }

  destroy(): void {
    this.glyphBuffer?.destroy();
    this.uniformBuffer?.destroy();
    this.fontTexture?.destroy();
  }

  private rebuildGlyphs(): void {
    let totalGlyphs = 0;
    for (const entry of this.entries) {
      totalGlyphs += entry.text.length;
    }

    if (totalGlyphs > this.glyphCapacity) {
      this.allocateGlyphBuffer(Math.max(totalGlyphs, this.glyphCapacity * 2));
    }

    let glyphIdx = 0;
    for (const entry of this.entries) {
      const scale = entry.fontSize / this.atlas.fontSize;
      let cursorX = entry.position.x;

      for (const char of entry.text) {
        const glyph = this.atlas.glyphs.get(char);
        if (!glyph) continue;

        const offset = glyphIdx * TEXT_GLYPH_FLOATS;

        const drawX = cursorX + glyph.xOffset * scale;
        const drawY = entry.position.y + glyph.yOffset * scale;
        const drawW = glyph.width * scale;
        const drawH = glyph.height * scale;

        const uvX = glyph.x / this.atlas.atlasWidth;
        const uvY = glyph.y / this.atlas.atlasHeight;
        const uvW = glyph.width / this.atlas.atlasWidth;
        const uvH = glyph.height / this.atlas.atlasHeight;

        this.glyphData[offset] = drawX;
        this.glyphData[offset + 1] = drawY;
        this.glyphData[offset + 2] = drawW;
        this.glyphData[offset + 3] = drawH;
        this.glyphData[offset + 4] = uvX;
        this.glyphData[offset + 5] = uvY;
        this.glyphData[offset + 6] = uvW;
        this.glyphData[offset + 7] = uvH;
        this.glyphData[offset + 8] = entry.color.r;
        this.glyphData[offset + 9] = entry.color.g;
        this.glyphData[offset + 10] = entry.color.b;
        this.glyphData[offset + 11] = entry.color.a;

        cursorX += glyph.xAdvance * scale;
        glyphIdx++;
      }
    }

    this.glyphCount = glyphIdx;

    if (glyphIdx > 0) {
      this.device.queue.writeBuffer(
        this.glyphBuffer,
        0,
        this.glyphData.buffer,
        0,
        glyphIdx * TEXT_GLYPH_STRIDE
      );
    }
  }

  private allocateGlyphBuffer(capacity: number): void {
    this.glyphBuffer?.destroy();

    this.glyphCapacity = capacity;
    this.glyphData = new Float32Array(capacity * TEXT_GLYPH_FLOATS);

    this.glyphBuffer = this.device.createBuffer({
      size: Math.max(1, capacity * TEXT_GLYPH_STRIDE),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.glyphBuffer } },
        { binding: 2, resource: this.fontTexture.createView() },
        { binding: 3, resource: this.fontSampler },
      ],
    });
  }

  private async loadShader(): Promise<string> {
    const url = new URL("../shaders/text.wgsl", import.meta.url);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load text shader: ${response.status}`);
    }
    return response.text();
  }
}
