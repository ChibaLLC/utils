import { mediaTypeFromShortType, normalizeMediaType } from "../formats";
import {
  assertOutputWithinLimits,
  assertSourceWithinLimits,
  normalizeTransformOptions,
  OUTPUT_MEDIA_TYPES,
  readBoundedInput,
  resolveImageLimits,
} from "../limits";
import {
  ImageTransformError,
  type ImageInfo,
  type ImageOutputFormat,
  type ImageTransformer,
  type ImageTransformerOptions,
} from "../types";

/**
 * Bun 1.4 decodes these with statically linked libjpeg-turbo, libspng, libwebp and a GIF first-frame decoder on every
 * platform. HEIC and AVIF depend on operating-system codecs (macOS or Windows only), so they are refused everywhere to
 * keep the same answer on every host.
 */
const INPUT_MEDIA_TYPES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
]);
const OUTPUT_FORMATS: ReadonlySet<ImageOutputFormat> = new Set(["webp", "jpeg"]);

/** The part of `Bun.Image` this adapter uses; see https://bun.com/docs/runtime/image. */
interface BunImage {
  resize(width: number, height?: number, options?: { fit?: "fill" | "inside"; withoutEnlargement?: boolean }): BunImage;
  webp(options?: { quality?: number }): BunImage;
  jpeg(options?: { quality?: number }): BunImage;
  bytes(): Promise<Uint8Array>;
  metadata(): Promise<{ width: number; height: number; format: string }>;
  readonly width: number;
  readonly height: number;
}
type BunImageConstructor = new (input: Uint8Array, options?: { maxPixels?: number; autoOrient?: boolean }) => BunImage;

function bunImageConstructor(): BunImageConstructor {
  const image = (globalThis as { Bun?: { Image?: BunImageConstructor } }).Bun?.Image;
  if (typeof image !== "function") {
    throw new ImageTransformError("adapter-unavailable", "Bun.Image needs Bun 1.4 or later");
  }
  return image;
}

/** The Bun adapter: the built-in `Bun.Image` pipeline, which runs off the JavaScript thread with no native addon. */
export function createBunImageTransformer(options: ImageTransformerOptions = {}): ImageTransformer {
  const Image = bunImageConstructor();
  const limits = resolveImageLimits(options.limits);
  const open = (bytes: Uint8Array) => new Image(bytes, { maxPixels: limits.maxInputPixels, autoOrient: true });

  const probeBytes = async (bytes: Uint8Array): Promise<ImageInfo> => {
    let meta: Awaited<ReturnType<BunImage["metadata"]>>;
    try {
      meta = await open(bytes).metadata();
    } catch (error) {
      throw bunError(error);
    }
    const mediaType = mediaTypeFromShortType(meta.format);
    if (!mediaType || !INPUT_MEDIA_TYPES.has(mediaType)) {
      throw new ImageTransformError("unsupported-format", "The image format is not supported");
    }
    const probed = Object.freeze({ mediaType, width: meta.width, height: meta.height });
    assertSourceWithinLimits(probed, limits);
    return probed;
  };

  return {
    target: "bun",
    limits,
    supports: (mediaType) => INPUT_MEDIA_TYPES.has(normalizeMediaType(mediaType)),
    supportsOutput: (format) => OUTPUT_FORMATS.has(format),
    async probe(input) {
      return probeBytes(await readBoundedInput(input, limits.maxInputBytes));
    },
    async transform(input, transformOptions) {
      const normalized = normalizeTransformOptions(transformOptions, limits);
      if (!OUTPUT_FORMATS.has(normalized.format)) {
        throw new ImageTransformError("invalid-options", "Bun cannot encode this format on every platform");
      }
      const bytes = await readBoundedInput(input, limits.maxInputBytes);
      const source = await probeBytes(bytes);
      const pipeline = open(bytes).resize(normalized.width, normalized.height, {
        fit: "inside",
        withoutEnlargement: true,
      });
      const encoded =
        normalized.format === "webp"
          ? pipeline.webp({ quality: normalized.quality })
          : pipeline.jpeg({ quality: normalized.quality });
      let body: Uint8Array;
      try {
        body = await encoded.bytes();
      } catch (error) {
        throw bunError(error);
      }
      assertOutputWithinLimits(body, limits);
      return Object.freeze({
        body,
        contentType: OUTPUT_MEDIA_TYPES[normalized.format],
        width: encoded.width,
        height: encoded.height,
        source,
      });
    },
  };
}

function bunError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? (error as { code: unknown }).code : "";
  switch (code) {
    case "ERR_IMAGE_TOO_MANY_PIXELS":
      return new ImageTransformError("too-many-pixels", "The image has more pixels than the limit", { cause: error });
    case "ERR_IMAGE_UNKNOWN_FORMAT":
    case "ERR_IMAGE_FORMAT_UNSUPPORTED":
      return new ImageTransformError("unsupported-format", "The image format is not supported", { cause: error });
    case "ERR_IMAGE_DECODE_FAILED":
      return new ImageTransformError("decode-failed", "The image could not be decoded", { cause: error });
    default:
      return new ImageTransformError("transform-failed", "The image transform failed", { cause: error });
  }
}
