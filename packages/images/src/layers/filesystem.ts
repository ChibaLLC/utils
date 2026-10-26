import { createStorage } from "unstorage";
import fsLiteDriver from "unstorage/drivers/fs-lite";
import lruCacheDriver from "unstorage/drivers/lru-cache";
import type { RenditionCacheLayer } from "../cache";
import type { RenditionLayerOptions } from "../layer-options";

const DEFAULT_MEMORY_ENTRIES = 512;
const DEFAULT_MEMORY_BYTES = 64 * 1024 * 1024;

/** Node and Bun layers: an in-process LRU, then a directory on disk as the durable copy. */
export function createRenditionLayers(options: RenditionLayerOptions): RenditionCacheLayer[] {
  if (!options.directory) throw new Error("Node and Bun rendition layers need a directory");
  const layers: RenditionCacheLayer[] = [];
  if (options.memory !== false) {
    layers.push({
      name: "memory",
      storage: createStorage({
        driver: lruCacheDriver({
          max: options.memory?.maxEntries ?? DEFAULT_MEMORY_ENTRIES,
          maxSize: options.memory?.maxBytes ?? DEFAULT_MEMORY_BYTES,
          sizeCalculation: (value: unknown) => (value instanceof Uint8Array ? Math.max(1, value.byteLength) : 1),
        }),
      }),
    });
  }
  const base = options.base ?? "renditions";
  layers.push({
    name: "disk",
    storage: createStorage({ driver: fsLiteDriver({ base: `${options.directory.replace(/\/+$/, "")}/${base}` }) }),
  });
  return layers;
}
