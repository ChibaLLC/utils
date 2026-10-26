import sharp from "sharp";

export interface ImageFixtures {
  readonly jpeg: Uint8Array;
  readonly png: Uint8Array;
  readonly gif: Uint8Array;
  readonly webp: Uint8Array;
  readonly small: Uint8Array;
  /** A tiny PNG whose header declares 10,000 x 10,000 pixels (100 MP): a decompression bomb. */
  readonly bomb: Uint8Array;
  readonly notAnImage: Uint8Array;
}

const bytes = (buffer: Buffer) => new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

/** Generated, so the repository carries no binary fixtures. */
export async function createFixtures(): Promise<ImageFixtures> {
  const solid = (width: number, height: number, alpha = 1) =>
    sharp({ create: { width, height, channels: 4, background: { r: 40, g: 100, b: 200, alpha } } });
  return {
    jpeg: bytes(await solid(3000, 2000).jpeg().toBuffer()),
    png: bytes(await solid(800, 1200, 0.5).png().toBuffer()),
    gif: bytes(await solid(300, 200).gif().toBuffer()),
    webp: bytes(await solid(1000, 1000).webp().toBuffer()),
    small: bytes(await solid(100, 50).png().toBuffer()),
    bomb: pngHeaderOnly(10_000, 10_000),
    notAnImage: new TextEncoder().encode("%PDF-1.7 definitely not a picture"),
  };
}

/** A valid PNG signature and IHDR declaring the given size, followed by a truncated IDAT and IEND. */
function pngHeaderOnly(width: number, height: number): Uint8Array {
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr.set([8, 0, 0, 0, 0], 8);
  return concat([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", new Uint8Array([0x78, 0x9c, 0x63, 0x00, 0x00])),
    chunk("IEND", new Uint8Array()),
  ]);
}

function chunk(type: string, data: Uint8Array) {
  const typed = concat([new TextEncoder().encode(type), data]);
  const out = new Uint8Array(12 + data.byteLength);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.byteLength);
  out.set(typed, 4);
  view.setUint32(8 + data.byteLength, crc32(typed));
  return out;
}

function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
