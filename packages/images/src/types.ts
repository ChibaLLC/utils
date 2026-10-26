/** The runtime an adapter is built for. The build target, not runtime detection, selects it. */
export type ImagesTarget = "cloudflare" | "node" | "bun";

/** Encoded output formats a transformer may produce. */
export type ImageOutputFormat = "webp" | "jpeg" | "avif";

/** Bytes of one image, either already in memory or as a stream. */
export type ImageInput = Uint8Array | ArrayBuffer | ReadableStream<Uint8Array>;

/** What a header probe learns about an image without decoding its pixels. */
export interface ImageInfo {
  /** The sniffed media type, e.g. `image/jpeg`. Never taken from a caller-supplied name or header. */
  readonly mediaType: string;
  /** Width after EXIF orientation is applied. */
  readonly width: number;
  /** Height after EXIF orientation is applied. */
  readonly height: number;
}

export interface ImageTransformOptions {
  /** Longest permitted output width. */
  readonly width: number;
  /** Longest permitted output height; defaults to `width`. */
  readonly height?: number;
  /**
   * `inside` keeps the aspect ratio and fits within `width` x `height` without enlarging a smaller image. It is the
   * only fit every adapter implements identically; crop for display in CSS (`object-fit: cover`).
   * @default "inside"
   */
  readonly fit?: "inside";
  readonly format: ImageOutputFormat;
  /** 1 to 100. @default 75 */
  readonly quality?: number;
}

export interface ImageTransformResult {
  readonly body: Uint8Array;
  readonly contentType: string;
  readonly width: number;
  readonly height: number;
  /** The probed source the output was made from. */
  readonly source: ImageInfo;
}

export interface ImageLimits {
  /** Largest accepted input in bytes, enforced while the input is read. */
  readonly maxInputBytes: number;
  /** Largest accepted input area (width x height), checked from the header before any pixel is decoded. */
  readonly maxInputPixels: number;
  /** Largest accepted input edge. */
  readonly maxInputDimension: number;
  /** Largest edge a caller may request. */
  readonly maxOutputDimension: number;
  /** Largest encoded output in bytes. */
  readonly maxOutputBytes: number;
}

export interface ImageTransformer {
  readonly target: ImagesTarget;
  readonly limits: ImageLimits;
  /** Whether this adapter can decode the media type. Check before reading any bytes. */
  supports(mediaType: string): boolean;
  /** Whether this adapter can encode the format on this build. */
  supportsOutput(format: ImageOutputFormat): boolean;
  /** Reads the header only and enforces the input limits. */
  probe(input: ImageInput): Promise<ImageInfo>;
  /** Probes, enforces every limit, then resizes and encodes. */
  transform(input: ImageInput, options: ImageTransformOptions): Promise<ImageTransformResult>;
}

export interface ImageTransformerOptions {
  readonly limits?: Partial<ImageLimits>;
  /** Cloudflare only: the Workers Images binding, e.g. `env.IMAGES`. */
  readonly binding?: ImagesBindingLike;
}

export type ImageTransformErrorCode =
  | "input-too-large"
  | "too-many-pixels"
  | "dimension-too-large"
  | "invalid-options"
  | "unsupported-format"
  | "decode-failed"
  | "output-too-large"
  | "adapter-unavailable"
  | "transform-failed";

const PERMANENT_CODES: ReadonlySet<ImageTransformErrorCode> = new Set([
  "input-too-large",
  "too-many-pixels",
  "dimension-too-large",
  "invalid-options",
  "unsupported-format",
  "decode-failed",
  "output-too-large",
]);

/**
 * A refused or failed transform. `permanent` is true when retrying the same input can never succeed, so callers can
 * record the input as unsupported instead of retrying.
 */
export class ImageTransformError extends Error {
  readonly code: ImageTransformErrorCode;
  readonly permanent: boolean;

  constructor(code: ImageTransformErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ImageTransformError";
    this.code = code;
    this.permanent = PERMANENT_CODES.has(code);
  }
}

/** The subset of the Workers Images binding the Cloudflare adapter uses. Structural, so no Workers types are needed. */
export interface ImagesBindingLike {
  info(stream: ReadableStream<Uint8Array>): Promise<{ format: string; width?: number; height?: number }>;
  input(stream: ReadableStream<Uint8Array>): ImagesTransformerLike;
}

export interface ImagesTransformerLike {
  transform(transform: { width?: number; height?: number; fit?: "scale-down" }): ImagesTransformerLike;
  output(options: {
    format: "image/webp" | "image/jpeg" | "image/avif";
    quality?: number;
    anim?: boolean;
  }): Promise<{ contentType(): string; image(): ReadableStream<Uint8Array> }>;
}
