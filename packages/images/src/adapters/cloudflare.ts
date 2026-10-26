import { normalizeMediaType, streamOfBytes } from "../formats";
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
  type ImageInput,
  type ImageOutputFormat,
  type ImagesBindingLike,
  type ImageTransformer,
  type ImageTransformerOptions,
} from "../types";

/** HEIC is decoded by the binding; AVIF input needs an Enterprise plan and SVG is never resized, so both are refused. */
const INPUT_MEDIA_TYPES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const OUTPUT_FORMATS: ReadonlySet<ImageOutputFormat> = new Set(["webp", "jpeg", "avif"]);
/** `ImagesError.code` for input that is not an image. */
const NOT_AN_IMAGE = 9412;

/**
 * The Workers Images binding adapter. Each distinct source and parameter set is billed once per calendar month as a
 * unique transformation; `info()` is free. Cache the output: the binding does not.
 */
export function createCloudflareImageTransformer(options: ImageTransformerOptions = {}): ImageTransformer {
  const binding = options.binding;
  if (!binding || typeof binding.input !== "function" || typeof binding.info !== "function") {
    throw new ImageTransformError("adapter-unavailable", "The Cloudflare image adapter needs the Images binding");
  }
  const limits = resolveImageLimits(options.limits);

  const probeBytes = async (bytes: Uint8Array): Promise<ImageInfo> => {
    let info: Awaited<ReturnType<ImagesBindingLike["info"]>>;
    try {
      info = await binding.info(streamOfBytes(bytes));
    } catch (error) {
      throw bindingError(error);
    }
    const mediaType = normalizeMediaType(info.format);
    if (!INPUT_MEDIA_TYPES.has(mediaType) || info.width === undefined || info.height === undefined) {
      throw new ImageTransformError("unsupported-format", "The image format is not supported");
    }
    const probed = Object.freeze({ mediaType, width: info.width, height: info.height });
    assertSourceWithinLimits(probed, limits);
    return probed;
  };

  return {
    target: "cloudflare",
    limits,
    supports: (mediaType) => INPUT_MEDIA_TYPES.has(normalizeMediaType(mediaType)),
    supportsOutput: (format) => OUTPUT_FORMATS.has(format),
    async probe(input: ImageInput) {
      return probeBytes(await readBoundedInput(input, limits.maxInputBytes));
    },
    async transform(input, transformOptions) {
      const normalized = normalizeTransformOptions(transformOptions, limits);
      const bytes = await readBoundedInput(input, limits.maxInputBytes);
      const source = await probeBytes(bytes);
      let body: Uint8Array;
      let contentType: string;
      try {
        const result = await binding
          .input(streamOfBytes(bytes))
          .transform({ width: normalized.width, height: normalized.height, fit: "scale-down" })
          .output({ format: OUTPUT_MEDIA_TYPES[normalized.format], quality: normalized.quality, anim: false });
        contentType = normalizeMediaType(result.contentType());
        body = await readBoundedInput(result.image(), limits.maxOutputBytes).catch((error: unknown) => {
          throw error instanceof ImageTransformError && error.code === "input-too-large"
            ? new ImageTransformError("output-too-large", "The encoded output is larger than the limit")
            : error;
        });
      } catch (error) {
        throw error instanceof ImageTransformError ? error : bindingError(error);
      }
      assertOutputWithinLimits(body, limits);
      if (contentType !== OUTPUT_MEDIA_TYPES[normalized.format]) {
        throw new ImageTransformError("transform-failed", "The binding returned an unexpected format");
      }
      // `info()` is not billed, and reports the dimensions the binding actually produced.
      const output = await binding.info(streamOfBytes(body)).catch((error: unknown) => {
        throw bindingError(error);
      });
      if (output.width === undefined || output.height === undefined) {
        throw new ImageTransformError("transform-failed", "The binding output has no dimensions");
      }
      return Object.freeze({ body, contentType, width: output.width, height: output.height, source });
    },
  };
}

function bindingError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? (error as { code: unknown }).code : 0;
  return code === NOT_AN_IMAGE
    ? new ImageTransformError("unsupported-format", "The input is not a supported image", { cause: error })
    : new ImageTransformError("transform-failed", "The Images binding failed", { cause: error });
}
