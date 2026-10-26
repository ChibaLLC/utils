import { createStorage, defineDriver } from "unstorage";
import cloudflareR2BindingDriver from "unstorage/drivers/cloudflare-r2-binding";
import type { RenditionCacheLayer } from "../cache";
import type { EdgeCacheLike, RenditionLayerOptions } from "../layer-options";

interface CacheApiDriverOptions {
  readonly cache?: EdgeCacheLike;
  /** Base URL for cache keys. Use a host on the Worker's own zone. */
  readonly origin?: string;
  readonly maxAgeSeconds?: number;
}

const DEFAULT_EDGE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/**
 * An unstorage driver over the Workers Cache API (per data centre, not listable). Entries are keyed by an internal URL
 * the Worker never serves, so only code holding the key can read them. Values are immutable bytes.
 */
export const cloudflareCacheApiDriver = defineDriver((options: CacheApiDriverOptions = {}) => {
  const origin = (options.origin ?? "https://renditions.cache.internal").replace(/\/+$/, "");
  const maxAge = options.maxAgeSeconds ?? DEFAULT_EDGE_MAX_AGE_SECONDS;
  const cache = () => {
    const resolved = options.cache ?? (globalThis as { caches?: { default?: EdgeCacheLike } }).caches?.default;
    if (!resolved) throw new Error("The Workers Cache API is unavailable");
    return resolved;
  };
  const url = (key: string) => `${origin}/${encodeURIComponent(key)}`;
  const read = async (key: string) => {
    const response = await cache().match(url(key));
    return response?.ok ? new Uint8Array(await response.arrayBuffer()) : null;
  };
  const write = (key: string, value: BodyInit) =>
    cache().put(
      url(key),
      new Response(value, {
        headers: {
          "cache-control": `public, max-age=${maxAge}, immutable`,
          "content-type": "application/octet-stream",
        },
      }),
    );
  return {
    name: "cloudflare-cache-api",
    options,
    async hasItem(key) {
      return (await cache().match(url(key))) !== undefined;
    },
    async getItem(key) {
      const bytes = await read(key);
      return bytes ? new TextDecoder().decode(bytes) : null;
    },
    getItemRaw: read,
    async setItem(key, value) {
      await write(key, value);
    },
    async setItemRaw(key, value) {
      await write(key, value as BodyInit);
    },
    async removeItem(key) {
      await cache().delete(url(key));
    },
    // The Cache API cannot enumerate or bulk-clear; entries expire on their own.
    getKeys: () => [],
    clear() {},
  };
});

/** Workers layers: the Cache API at the edge, then the R2 binding as the durable copy. */
export function createRenditionLayers(options: RenditionLayerOptions): RenditionCacheLayer[] {
  if (!options.r2) throw new Error("Cloudflare rendition layers need an R2 bucket binding");
  const base = options.base ?? "renditions";
  const layers: RenditionCacheLayer[] = [];
  if (options.edge !== false) {
    layers.push({
      name: "edge",
      storage: createStorage({
        driver: cloudflareCacheApiDriver({
          ...(options.edge?.cache ? { cache: options.edge.cache } : {}),
          origin: options.edge?.origin ?? `https://renditions.cache.internal/${base}`,
          ...(options.edge?.maxAgeSeconds === undefined ? {} : { maxAgeSeconds: options.edge.maxAgeSeconds }),
        }),
      }),
    });
  }
  layers.push({
    name: "r2",
    storage: createStorage({ driver: cloudflareR2BindingDriver({ binding: options.r2, base }) }),
  });
  return layers;
}
