/** Normalizes a media type for comparison: lowercase, parameters removed, `image/jpg` treated as `image/jpeg`. */
export function normalizeMediaType(mediaType: string): string {
  const base = mediaType.split(";", 1)[0]!.trim().toLowerCase();
  return base === "image/jpg" || base === "image/pjpeg" ? "image/jpeg" : base;
}

/** Media types for the short type names that header parsers (`image-meta`, Bun.Image) report. */
const SHORT_TYPE_MEDIA_TYPES: Readonly<Record<string, string>> = Object.freeze({
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  tiff: "image/tiff",
  bmp: "image/bmp",
});

export function mediaTypeFromShortType(type: string | undefined): string | undefined {
  return type === undefined ? undefined : SHORT_TYPE_MEDIA_TYPES[type.toLowerCase()];
}

/** EXIF orientations 5 to 8 rotate by 90 degrees, so the displayed width and height swap. */
export function orientedDimensions(width: number, height: number, orientation: number | undefined) {
  return orientation !== undefined && orientation >= 5 && orientation <= 8
    ? { width: height, height: width }
    : { width, height };
}

export function streamOfBytes(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}
