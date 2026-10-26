import { imageMeta } from "image-meta";
import { ImageTransformError, type ImageLimits, type ImageTransformer } from "../src/shared";
import type { ImageFixtures } from "./fixtures";

/**
 * Behaviour every adapter must share. Framework-free so Vitest (Node) and `bun` run the identical cases.
 */
export interface ConformanceCase {
  readonly name: string;
  run(): Promise<void>;
}

export function conformanceCases(
  create: (limits?: Partial<ImageLimits>) => ImageTransformer,
  fixtures: ImageFixtures,
): ConformanceCase[] {
  const transformer = create();
  return [
    {
      name: "declares the formats every adapter decodes",
      async run() {
        for (const type of ["image/jpeg", "image/png", "image/gif", "image/webp", "IMAGE/JPG; charset=x"]) {
          assert(transformer.supports(type), `supports ${type}`);
        }
        for (const type of ["image/svg+xml", "application/pdf", "text/plain"]) {
          assert(!transformer.supports(type), `refuses ${type}`);
        }
        assert(transformer.supportsOutput("webp") && transformer.supportsOutput("jpeg"), "encodes webp and jpeg");
      },
    },
    {
      name: "probes dimensions from the header",
      async run() {
        const info = await transformer.probe(fixtures.jpeg);
        equal(info.mediaType, "image/jpeg");
        equal(info.width, 3000);
        equal(info.height, 2000);
      },
    },
    {
      name: "shrinks a landscape JPEG inside the box as WebP",
      async run() {
        const result = await transformer.transform(fixtures.jpeg, { width: 640, format: "webp", quality: 75 });
        equal(result.contentType, "image/webp");
        equal(result.width, 640);
        equal(result.height, 427);
        equal(result.source.width, 3000);
        const meta = imageMeta(result.body);
        equal(meta.type, "webp");
        equal(meta.width, 640);
        assert(result.body.byteLength < fixtures.jpeg.byteLength, "output is smaller than the source");
      },
    },
    {
      name: "shrinks a portrait PNG with alpha inside the box",
      async run() {
        const result = await transformer.transform(fixtures.png, { width: 640, format: "webp" });
        equal(result.width, 427);
        equal(result.height, 640);
      },
    },
    {
      name: "renders the first frame of a GIF",
      async run() {
        const result = await transformer.transform(fixtures.gif, { width: 160, format: "webp" });
        equal(result.contentType, "image/webp");
        equal(result.width, 160);
        equal(result.height, 107);
      },
    },
    {
      name: "accepts a stream input",
      async run() {
        const result = await transformer.transform(streamOf(fixtures.webp), { width: 160, format: "jpeg" });
        equal(result.contentType, "image/jpeg");
        equal(result.width, 160);
        equal(imageMeta(result.body).type, "jpg");
      },
    },
    {
      name: "never enlarges a smaller image",
      async run() {
        const result = await transformer.transform(fixtures.small, { width: 640, format: "webp" });
        equal(result.width, 100);
        equal(result.height, 50);
      },
    },
    {
      name: "refuses a decompression bomb before decoding it",
      async run() {
        await rejects(transformer.probe(fixtures.bomb), ["too-many-pixels"]);
        await rejects(transformer.transform(fixtures.bomb, { width: 160, format: "webp" }), ["too-many-pixels"]);
      },
    },
    {
      name: "refuses an input over the byte limit while reading it",
      async run() {
        const strict = create({ maxInputBytes: 1024 });
        await rejects(strict.transform(streamOf(fixtures.jpeg), { width: 160, format: "webp" }), ["input-too-large"]);
      },
    },
    {
      name: "refuses an image over the pixel limit",
      async run() {
        const strict = create({ maxInputPixels: 1_000_000 });
        await rejects(strict.transform(fixtures.jpeg, { width: 160, format: "webp" }), ["too-many-pixels"]);
      },
    },
    {
      name: "refuses an output over the byte limit",
      async run() {
        const strict = create({ maxOutputBytes: 16 });
        await rejects(strict.transform(fixtures.jpeg, { width: 640, format: "webp" }), ["output-too-large"]);
      },
    },
    {
      name: "refuses bytes that are not an image as a permanent failure",
      async run() {
        const error = await rejects(transformer.transform(fixtures.notAnImage, { width: 160, format: "webp" }), [
          "unsupported-format",
          "decode-failed",
        ]);
        assert(error.permanent, "an undecodable input is permanent");
      },
    },
    {
      name: "refuses invalid options",
      async run() {
        await rejects(transformer.transform(fixtures.small, { width: 0, format: "webp" }), ["invalid-options"]);
        await rejects(transformer.transform(fixtures.small, { width: 99_999, format: "webp" }), ["invalid-options"]);
        await rejects(transformer.transform(fixtures.small, { width: 64, format: "webp", quality: 101 }), [
          "invalid-options",
        ]);
      },
    },
  ];
}

function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.byteLength) return controller.close();
      controller.enqueue(bytes.subarray(offset, offset + 4096));
      offset += 4096;
    },
  });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function equal(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
}

async function rejects(promise: Promise<unknown>, codes: readonly string[]): Promise<ImageTransformError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ImageTransformError && codes.includes(error.code)) return error;
    throw new Error(`Expected ${codes.join(" or ")}, received ${String((error as { code?: unknown }).code ?? error)}`);
  }
  throw new Error(`Expected ${codes.join(" or ")}, but the transform succeeded`);
}
