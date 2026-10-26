import sharp from "sharp";
import type { ImagesBindingLike, ImagesTransformerLike } from "../src/types";

const FORMATS: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };

/**
 * A stand-in for the Workers Images binding with the same contract: streams in, `info()` reporting the media type and
 * dimensions, a 9412 error for input that is not an image, and `scale-down` never enlarging. sharp does the pixels.
 */
export function createMockImagesBinding(calls: { info: number; transform: number } = { info: 0, transform: 0 }) {
  const binding: ImagesBindingLike & { calls: typeof calls } = {
    calls,
    async info(stream) {
      calls.info += 1;
      const bytes = await new Response(stream).arrayBuffer();
      const meta = await sharp(bytes)
        .metadata()
        .catch(() => undefined);
      const format = meta?.format ? FORMATS[meta.format] : undefined;
      if (!meta || !format) throw Object.assign(new Error("ERROR 9412: Input is not an image"), { code: 9412 });
      return { format, fileSize: bytes.byteLength, width: meta.width, height: meta.height };
    },
    input(stream) {
      const steps: { width?: number; height?: number; fit?: string }[] = [];
      const handle: ImagesTransformerLike = {
        transform(transform) {
          steps.push(transform);
          return handle;
        },
        async output(options) {
          calls.transform += 1;
          const bytes = await new Response(stream).arrayBuffer();
          let pipeline = sharp(bytes, { pages: options.anim === false ? 1 : -1 }).rotate();
          for (const step of steps) {
            pipeline = pipeline.resize(step.width, step.height, {
              fit: "inside",
              withoutEnlargement: step.fit === "scale-down",
            });
          }
          const format = options.format.slice("image/".length) as "webp" | "jpeg" | "avif";
          const output = await pipeline.toFormat(format, { quality: options.quality ?? 85 }).toBuffer();
          return {
            contentType: () => options.format,
            image: () => new Response(output).body!,
          };
        },
      };
      return handle;
    },
  };
  return binding;
}
