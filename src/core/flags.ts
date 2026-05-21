export type ShaderStageFlags = {
  VERTEX: number;
  FRAGMENT: number;
  COMPUTE: number;
};

export type BufferUsageFlags = {
  COPY_DST: number;
  UNIFORM: number;
  STORAGE: number;
};

export const ShaderStage: ShaderStageFlags =
  (globalThis as { GPUShaderStage?: ShaderStageFlags }).GPUShaderStage ??
  ({ VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 } as const);

export const BufferUsage: BufferUsageFlags =
  (globalThis as { GPUBufferUsage?: BufferUsageFlags }).GPUBufferUsage ??
  ({ COPY_DST: 8, UNIFORM: 64, STORAGE: 128 } as const);
