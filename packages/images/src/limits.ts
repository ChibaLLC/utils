import {
  ImageTransformError,
  type ImageInfo,
  type ImageInput,
  type ImageLimits,
  type ImageOutputFormat,
  type ImageTransformOptions,
} from "./types";

/**
 * Conservative defaults. 20 MiB matches the Workers Images binding input cap; 50 MP admits a 48 MP phone photo and
 * refuses a decompression bomb before its pixels are allocated.
 */
export const DEFAULT_IMAGE_LIMITS: ImageLimits = Object.freeze({
  maxInputBytes: 20 * 1024 * 1024,
  maxInputPixels: 50_000_000,
  maxInputDimension: 12_000,
  maxOutputDimension: 2_048,
  maxOutputBytes: 2 * 1024 * 1024,
});

export function resolveImageLimits(overrides: Partial<ImageLimits> | undefined): ImageLimits {
  const limits = { ...DEFAULT_IMAGE_LIMITS, ...overrides };
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new ImageTransformError("invalid-options", `Image limit ${name} must be a positive integer`);
    }
  }
  return Object.freeze(limits);
}

/** Refuses a probed source that is over any input limit. */
export function assertSourceWithinLimits(info: ImageInfo, limits: ImageLimits): void {
  if (!Number.isSafeInteger(info.width) || !Number.isSafeInteger(info.height) || info.width < 1 || info.height < 1) {
    throw new ImageTransformError("decode-failed", "The image header has no usable dimensions");
  }
  if (info.width > limits.maxInputDimension || info.height > limits.maxInputDimension) {
    throw new ImageTransformError("dimension-too-large", "The image is wider or taller than the limit");
  }
  if (info.width * info.height > limits.maxInputPixels) {
    throw new ImageTransformError("too-many-pixels", "The image has more pixels than the limit");
  }
}

export interface NormalizedTransform {
  readonly width: number;
  readonly height: number;
  readonly fit: "inside";
  readonly format: ImageOutputFormat;
  readonly quality: number;
}

export function normalizeTransformOptions(options: ImageTransformOptions, limits: ImageLimits): NormalizedTransform {
  const height = options.height ?? options.width;
  const quality = options.quality ?? 75;
  const fit = options.fit ?? "inside";
  if (
    !isDimension(options.width, limits) ||
    !isDimension(height, limits) ||
    !Number.isInteger(quality) ||
    quality < 1 ||
    quality > 100 ||
    fit !== "inside" ||
    !(options.format in OUTPUT_MEDIA_TYPES)
  ) {
    throw new ImageTransformError("invalid-options", "The transform options are invalid");
  }
  return Object.freeze({ width: options.width, height, fit, format: options.format, quality });
}

function isDimension(value: number, limits: ImageLimits) {
  return Number.isSafeInteger(value) && value >= 1 && value <= limits.maxOutputDimension;
}

export const OUTPUT_MEDIA_TYPES = Object.freeze({
  webp: "image/webp",
  jpeg: "image/jpeg",
  avif: "image/avif",
} as const) satisfies Readonly<Record<ImageOutputFormat, string>>;

export function assertOutputWithinLimits(body: Uint8Array, limits: ImageLimits): void {
  if (body.byteLength === 0) {
    throw new ImageTransformError("transform-failed", "The transform produced no bytes");
  }
  if (body.byteLength > limits.maxOutputBytes) {
    throw new ImageTransformError("output-too-large", "The encoded output is larger than the limit");
  }
}

/**
 * Reads an input into memory, refusing it as soon as it passes `maxBytes`. Renditions are made from bounded inputs only,
 * so a caller never holds more than the limit.
 */
export async function readBoundedInput(input: ImageInput, maxBytes: number): Promise<Uint8Array> {
  if (input instanceof Uint8Array || input instanceof ArrayBuffer) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (bytes.byteLength > maxBytes) {
      throw new ImageTransformError("input-too-large", "The image is larger than the input limit");
    }
    return bytes;
  }
  const reader = input.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new ImageTransformError("input-too-large", "The image is larger than the input limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** The output box for `inside` without enlargement, used where an encoder does not report its own dimensions. */
export function insideDimensions(source: { width: number; height: number }, box: { width: number; height: number }) {
  const scale = Math.min(1, box.width / source.width, box.height / source.height);
  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  };
}
