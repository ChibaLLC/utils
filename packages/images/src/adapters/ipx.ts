import { imageMeta } from "image-meta";
import { createIPX, type IPX } from "ipx";
import { mediaTypeFromShortType, normalizeMediaType, orientedDimensions } from "../formats";
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
 * sharp's prebuilt libvips decodes these. HEIC needs an HEVC decoder the prebuilt binaries do not ship, and SVG is
 * refused because a rendition must never execute or fetch anything.
 */
const INPUT_MEDIA_TYPES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/tiff",
]);
const OUTPUT_FORMATS: ReadonlySet<ImageOutputFormat> = new Set(["webp", "jpeg", "avif"]);

/** The Node adapter: `ipx` (unjs) over `sharp`. Also runs under Bun, though the Bun build uses `Bun.Image`. */
export function createIpxImageTransformer(options: ImageTransformerOptions = {}): ImageTransformer {
  const limits = resolveImageLimits(options.limits);
  // ipx reads sources through a storage; each transform lends its bytes under a one-use id.
  const sources = new Map<string, Uint8Array>();
  const ipx: IPX = createIPX({
    storage: {
      name: "chiballc-images",
      getMeta: () => ({}),
      getData: (id: string) => {
        const bytes = sources.get(id);
        return bytes && Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      },
    },
    maxOutputDimension: limits.maxOutputDimension,
    sharpOptions: { limitInputPixels: limits.maxInputPixels, animated: false, failOn: "error" },
  });

  const probeBytes = (bytes: Uint8Array): ImageInfo => {
    let meta: ReturnType<typeof imageMeta>;
    try {
      meta = imageMeta(bytes);
    } catch (error) {
      throw new ImageTransformError("unsupported-format", "The image format is not recognised", { cause: error });
    }
    const mediaType = mediaTypeFromShortType(meta.type);
    if (!mediaType || !INPUT_MEDIA_TYPES.has(mediaType)) {
      throw new ImageTransformError("unsupported-format", "The image format is not supported");
    }
    const probed = Object.freeze({ mediaType, ...orientedDimensions(meta.width, meta.height, meta.orientation) });
    assertSourceWithinLimits(probed, limits);
    return probed;
  };

  return {
    target: "node",
    limits,
    supports: (mediaType) => INPUT_MEDIA_TYPES.has(normalizeMediaType(mediaType)),
    supportsOutput: (format) => OUTPUT_FORMATS.has(format),
    async probe(input) {
      return probeBytes(await readBoundedInput(input, limits.maxInputBytes));
    },
    async transform(input, transformOptions) {
      const normalized = normalizeTransformOptions(transformOptions, limits);
      const bytes = await readBoundedInput(input, limits.maxInputBytes);
      const source = probeBytes(bytes);
      const id = `/${crypto.randomUUID()}`;
      sources.set(id, bytes);
      let data: Buffer | string;
      try {
        ({ data } = await ipx(id, {
          resize: `${normalized.width}x${normalized.height}`,
          fit: normalized.fit,
          format: normalized.format,
          quality: normalized.quality,
          autoorient: true,
        }).process());
      } catch (error) {
        throw sharpError(error);
      } finally {
        sources.delete(id);
      }
      if (typeof data === "string") {
        throw new ImageTransformError("transform-failed", "ipx returned text for a raster image");
      }
      const body = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      assertOutputWithinLimits(body, limits);
      const output = imageMeta(body);
      return Object.freeze({
        body,
        contentType: OUTPUT_MEDIA_TYPES[normalized.format],
        width: output.width,
        height: output.height,
        source,
      });
    },
  };
}

function sharpError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/pixel limit/i.test(message)) {
    return new ImageTransformError("too-many-pixels", "The image has more pixels than the limit", { cause: error });
  }
  if (/unsupported image format|corrupt|premature end|invalid|bad/i.test(message)) {
    return new ImageTransformError("decode-failed", "The image could not be decoded", { cause: error });
  }
  return new ImageTransformError("transform-failed", "The image transform failed", { cause: error });
}
