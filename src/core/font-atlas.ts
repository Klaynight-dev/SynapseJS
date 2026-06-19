import type { FontAtlas, GlyphMetrics } from "./types";

const DEFAULT_CHARS =
  " !\"#$%&'()*+,-./0123456789:;<=>?@" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`" +
  "abcdefghijklmnopqrstuvwxyz{|}~" +
  "ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖÙÚÛÜÝàáâãäåæçèéêëìíîïðñòóôõöùúûüý";

const SDF_PADDING = 4;
const SDF_SPREAD = 4;

export async function generateFontAtlas(
  fontSize: number,
  fontFamily = "sans-serif",
  chars = DEFAULT_CHARS
): Promise<FontAtlas> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const cellSize = fontSize + SDF_PADDING * 2;
  const cols = Math.ceil(Math.sqrt(chars.length));
  const rows = Math.ceil(chars.length / cols);

  const atlasWidth = nextPowerOfTwo(cols * cellSize);
  const atlasHeight = nextPowerOfTwo(rows * cellSize);

  canvas.width = atlasWidth;
  canvas.height = atlasHeight;

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, atlasWidth, atlasHeight);

  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textBaseline = "top";
  ctx.fillStyle = "white";

  const glyphs = new Map<string, GlyphMetrics>();

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const col = i % cols;
    const row = Math.floor(i / cols);

    const x = col * cellSize + SDF_PADDING;
    const y = row * cellSize + SDF_PADDING;

    ctx.fillText(char, x, y);

    const metrics = ctx.measureText(char);
    const charWidth = metrics.width;

    glyphs.set(char, {
      char,
      x: col * cellSize,
      y: row * cellSize,
      width: cellSize,
      height: cellSize,
      xOffset: SDF_PADDING,
      yOffset: SDF_PADDING,
      xAdvance: charWidth,
    });
  }

  const imageData = ctx.getImageData(0, 0, atlasWidth, atlasHeight);
  const sdfData = computeSDF(imageData, SDF_SPREAD);

  ctx.putImageData(sdfData, 0, 0);

  const bitmap = await createImageBitmap(canvas);

  return {
    texture: bitmap,
    glyphs,
    fontSize,
    lineHeight: fontSize * 1.2,
    atlasWidth,
    atlasHeight,
  };
}

function computeSDF(imageData: ImageData, spread: number): ImageData {
  const { width, height, data } = imageData;
  const output = new ImageData(width, height);
  const outData = output.data;
  const totalPixels = width * height;
  const INF = 1e20;

  const inside = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    inside[i] = data[i * 4] > 127 ? 1 : 0;
  }

  const distOutside = new Float32Array(totalPixels);
  const distInside = new Float32Array(totalPixels);
  distOutside.fill(INF);
  distInside.fill(INF);

  for (let i = 0; i < totalPixels; i++) {
    if (inside[i]) {
      distOutside[i] = INF;
      distInside[i] = 0;
    } else {
      distOutside[i] = 0;
      distInside[i] = INF;
    }
  }

  const temp = new Float32Array(Math.max(width, height));
  const v = new Int32Array(Math.max(width, height));
  const z = new Float32Array(Math.max(width, height) + 1);

  function edt1d(grid: Float32Array, offset: number, stride: number, length: number): void {
    for (let i = 0; i < length; i++) {
      temp[i] = grid[offset + i * stride];
    }

    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    let k = 0;

    for (let q = 1; q < length; q++) {
      let s = ((temp[q] + q * q) - (temp[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (k > 0 && s <= z[k]) {
        k--;
        s = ((temp[q] + q * q) - (temp[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }

    k = 0;
    for (let q = 0; q < length; q++) {
      while (z[k + 1] < q) k++;
      const dq = q - v[k];
      grid[offset + q * stride] = dq * dq + temp[v[k]];
    }
  }

  function edt2d(grid: Float32Array): void {
    for (let y = 0; y < height; y++) {
      edt1d(grid, y * width, 1, width);
    }
    for (let x = 0; x < width; x++) {
      edt1d(grid, x, width, height);
    }
  }

  edt2d(distOutside);
  edt2d(distInside);

  for (let i = 0; i < totalPixels; i++) {
    const dist = Math.sqrt(distOutside[i]) - Math.sqrt(distInside[i]);
    const normalizedDist = Math.min(Math.max(-dist / spread, -1), 1);
    const sdfValue = 0.5 + normalizedDist * 0.5;
    const byte = Math.max(0, Math.min(255, Math.round(sdfValue * 255)));
    const idx = i * 4;
    outData[idx] = byte;
    outData[idx + 1] = byte;
    outData[idx + 2] = byte;
    outData[idx + 3] = 255;
  }

  return output;
}

function nextPowerOfTwo(n: number): number {
  let v = n - 1;
  v |= v >> 1;
  v |= v >> 2;
  v |= v >> 4;
  v |= v >> 8;
  v |= v >> 16;
  return v + 1;
}

export function measureText(
  atlas: FontAtlas,
  text: string
): { width: number; height: number } {
  let width = 0;
  for (const char of text) {
    const glyph = atlas.glyphs.get(char);
    if (glyph) {
      width += glyph.xAdvance;
    }
  }
  return { width, height: atlas.lineHeight };
}
