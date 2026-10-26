import { createStorage } from "unstorage";
import memoryDriver from "unstorage/drivers/memory";
import { beforeAll, describe, expect, it } from "vitest";
import { createCloudflareImageTransformer } from "../src/adapters/cloudflare";
import { createIpxImageTransformer } from "../src/adapters/ipx";
import { createRenditionCache, createSingleFlight } from "../src/cache";
import { createImageTransformer as createCoreTransformer } from "../src/core";
import { cloudflareCacheApiDriver } from "../src/layers/cloudflare";
import { createRenditionLayers } from "../src/layers/filesystem";
import { applyImagesAlias, IMAGES_ALIAS } from "../src/nitro";
import { resolveImagesTarget } from "../src/target";
import { ImageTransformError } from "../src/types";
import { conformanceCases, type ConformanceCase } from "./conformance";
import { createFixtures, type ImageFixtures } from "./fixtures";
import { createMockImagesBinding } from "./mock-images-binding";

let fixtures: ImageFixtures;
const suites: Record<string, ConformanceCase[]> = {};

beforeAll(async () => {
  fixtures = await createFixtures();
  suites.node = conformanceCases((limits) => createIpxImageTransformer(limits ? { limits } : {}), fixtures);
  suites.cloudflare = conformanceCases(
    (limits) => createCloudflareImageTransformer({ binding: createMockImagesBinding(), ...(limits ? { limits } : {}) }),
    fixtures,
  );
});

const CASES = conformanceCases(() => ({}) as never, {} as ImageFixtures).map((entry) => entry.name);

describe.each(["node", "cloudflare"])("%s adapter conformance", (target) => {
  it.each(CASES)("%s", async (name) => {
    const entry = suites[target]!.find((candidate) => candidate.name === name)!;
    await entry.run();
  });
});

describe("cloudflare adapter", () => {
  it("needs the binding", () => {
    expect(() => createCloudflareImageTransformer({})).toThrow(ImageTransformError);
  });

  it("refuses an oversized image without calling the billed transform", async () => {
    const calls = { info: 0, transform: 0 };
    const transformer = createCloudflareImageTransformer({
      binding: createMockImagesBinding(calls),
      limits: { maxInputPixels: 1_000_000 },
    });
    await expect(transformer.transform(fixtures.jpeg, { width: 160, format: "webp" })).rejects.toMatchObject({
      code: "too-many-pixels",
    });
    expect(calls).toEqual({ info: 1, transform: 0 });
  });

  it("supports HEIC input where the binding decodes it", () => {
    expect(createCloudflareImageTransformer({ binding: createMockImagesBinding() }).supports("image/heic")).toBe(true);
  });
});

describe("core entry", () => {
  it("has no adapter", () => {
    expect(() => createCoreTransformer()).toThrow(/No image adapter/);
  });
});

describe("rendition cache", () => {
  const layer = (name: string) => ({ name, storage: createStorage({ driver: memoryDriver() }) });

  it("reads the fastest layer, refills faster layers and writes durable first", async () => {
    const edge = layer("edge");
    const durable = layer("durable");
    const cache = createRenditionCache({ layers: [edge, durable] });
    await durable.storage.setItemRaw("a", new Uint8Array([1, 2, 3]));
    expect(await cache.get("a")).toMatchObject({ layer: "durable" });
    expect(await cache.get("a")).toMatchObject({ layer: "edge" });
    expect(await cache.get("missing")).toBeUndefined();
  });

  it("produces each key once for concurrent callers", async () => {
    const cache = createRenditionCache({ layers: [layer("edge"), layer("durable")] });
    let produced = 0;
    const produce = async () => {
      produced += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Uint8Array([9]);
    };
    const results = await Promise.all(Array.from({ length: 8 }, () => cache.getOrCreate("k", produce)));
    expect(produced).toBe(1);
    expect(results.every((result) => result.layer === "created" && result.bytes[0] === 9)).toBe(true);
    expect(await cache.getOrCreate("k", produce)).toMatchObject({ layer: "edge" });
    expect(produced).toBe(1);
  });

  it("treats a failing faster layer as a miss but surfaces a durable failure", async () => {
    const broken = { name: "edge", storage: createStorage({ driver: memoryDriver() }) };
    broken.storage.getItemRaw = async () => {
      throw new Error("edge down");
    };
    const durable = layer("durable");
    await durable.storage.setItemRaw("a", new Uint8Array([1]));
    expect(await createRenditionCache({ layers: [broken, durable] }).get("a")).toMatchObject({ layer: "durable" });
    expect(createRenditionCache({ layers: [durable, broken] }).get("a")).resolves.toMatchObject({ layer: "durable" });
    await expect(createRenditionCache({ layers: [broken] }).get("a")).rejects.toThrow("edge down");
  });

  it("does not share a failed flight", async () => {
    const flights = createSingleFlight<number>();
    await expect(flights.run("k", async () => Promise.reject(new Error("no")))).rejects.toThrow("no");
    expect(flights.size).toBe(0);
    expect(await flights.run("k", async () => 1)).toBe(1);
  });

  it("stores bytes on disk behind an LRU", async () => {
    const { mkdtemp, rm } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const directory = await mkdtemp(`${tmpdir()}/renditions-`);
    try {
      const [memory, disk] = createRenditionLayers({ directory });
      expect([memory!.name, disk!.name]).toEqual(["memory", "disk"]);
      const cache = createRenditionCache({ layers: [memory!, disk!] });
      await cache.put("item:v1:640", new Uint8Array([7, 7]));
      const reopened = createRenditionCache({ layers: createRenditionLayers({ directory, memory: false }) });
      const hit = await reopened.get("item:v1:640");
      expect(hit?.layer).toBe("disk");
      expect([...hit!.bytes]).toEqual([7, 7]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("keeps Workers edge entries under internal URLs with a long immutable lifetime", async () => {
    const entries = new Map<string, Response>();
    const cache = {
      match: async (url: string) => entries.get(url)?.clone(),
      put: async (url: string, response: Response) => void entries.set(url, response),
      delete: async (url: string) => entries.delete(url),
    };
    const storage = createStorage({ driver: cloudflareCacheApiDriver({ cache, origin: "https://cache.internal/r" }) });
    await storage.setItemRaw("ws:item:v1", new Uint8Array([5]));
    const [url, response] = [...entries][0]!;
    expect(url).toBe("https://cache.internal/r/ws%3Aitem%3Av1");
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect([...((await storage.getItemRaw("ws:item:v1")) as Uint8Array)]).toEqual([5]);
    expect(await storage.getKeys()).toEqual([]);
  });
});

describe("build target", () => {
  it.each([
    ["cloudflare-module", "cloudflare"],
    ["cloudflare_pages", "cloudflare"],
    ["bun", "bun"],
    ["node-server", "node"],
    ["node-cluster", "node"],
    [undefined, "node"],
  ] as const)("maps preset %s to %s", (preset, target) => {
    expect(resolveImagesTarget(preset)).toBe(target);
  });

  it.each(["vercel-edge", "netlify-edge", "deno-deploy"])("refuses %s, which has no adapter", (preset) => {
    expect(() => resolveImagesTarget(preset)).toThrow(/set the target explicitly/);
  });

  it("aliases the Nitro entry and lets an explicit target win", () => {
    const nitro: { options: { preset: string; alias: Record<string, string> } } = {
      options: { preset: "cloudflare-module", alias: { keep: "x" } },
    };
    expect(applyImagesAlias(nitro)).toBe("cloudflare");
    expect(nitro.options.alias).toEqual({ keep: "x", [IMAGES_ALIAS]: "@chiballc/utils/images/cloudflare" });
    expect(applyImagesAlias(nitro, { target: "bun" })).toBe("bun");
    expect(nitro.options.alias[IMAGES_ALIAS]).toBe("@chiballc/utils/images/bun");
  });
});
