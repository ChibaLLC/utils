import type { Storage } from "unstorage";

/** One tier of a rendition cache, fastest first: an edge or memory cache, then durable object storage. */
export interface RenditionCacheLayer {
  readonly name: string;
  readonly storage: Storage;
}

export interface RenditionCacheHit {
  readonly bytes: Uint8Array;
  /** The layer that answered, or `created` when the bytes were produced by this call. */
  readonly layer: string;
}

export interface RenditionCache {
  /** Reads from the fastest layer that has the key and refills the faster layers it missed. */
  get(key: string): Promise<RenditionCacheHit | undefined>;
  /** Writes the slowest (durable) layer first, so a faster layer never holds bytes the durable layer lacks. */
  put(key: string, bytes: Uint8Array): Promise<void>;
  /**
   * Returns cached bytes, or runs `produce` once per key in this process however many callers ask concurrently,
   * stores the result in every layer and returns it.
   */
  getOrCreate(key: string, produce: () => Promise<Uint8Array>): Promise<RenditionCacheHit>;
}

export interface RenditionCacheOptions {
  readonly layers: readonly RenditionCacheLayer[];
  /** Receives background refills of faster layers, e.g. a Worker's `ctx.waitUntil`. Awaited inline when absent. */
  readonly defer?: (work: Promise<unknown>) => void;
}

/**
 * Keys are opaque to the cache. Callers must build them from immutable identity (for example an item, its version, the
 * output size and the content validator) so that a key never names two different byte strings.
 */
export function createRenditionCache(options: RenditionCacheOptions): RenditionCache {
  const layers = [...options.layers];
  if (layers.length === 0) throw new TypeError("A rendition cache needs at least one layer");
  const flights = createSingleFlight<RenditionCacheHit>();

  const refill = async (key: string, bytes: Uint8Array, upTo: number) => {
    const writes = layers.slice(0, upTo).map((layer) => layer.storage.setItemRaw(key, bytes).catch(() => undefined));
    const work = Promise.all(writes);
    if (options.defer) options.defer(work);
    else await work;
  };

  const get = async (key: string): Promise<RenditionCacheHit | undefined> => {
    for (const [index, layer] of layers.entries()) {
      const durable = index === layers.length - 1;
      let raw: unknown;
      try {
        raw = await layer.storage.getItemRaw(key);
      } catch (error) {
        // A faster layer is an optimisation; only the durable layer's failure is the caller's concern.
        if (durable) throw error;
        continue;
      }
      const bytes = toBytes(raw);
      if (!bytes) continue;
      if (index > 0) await refill(key, bytes, index);
      return { bytes, layer: layer.name };
    }
    return undefined;
  };

  const put = async (key: string, bytes: Uint8Array) => {
    const durable = layers[layers.length - 1]!;
    await durable.storage.setItemRaw(key, bytes);
    await refill(key, bytes, layers.length - 1);
  };

  return {
    get,
    put,
    getOrCreate(key, produce) {
      return flights.run(key, async () => {
        const hit = await get(key);
        if (hit) return hit;
        const bytes = await produce();
        await put(key, bytes);
        return { bytes, layer: "created" };
      });
    },
  };
}

export interface SingleFlight<T> {
  /** Runs `work` unless a call for the same key is already in flight, in which case it shares that call's result. */
  run(key: string, work: () => Promise<T>): Promise<T>;
  readonly size: number;
}

export function createSingleFlight<T>(): SingleFlight<T> {
  const inFlight = new Map<string, Promise<T>>();
  return {
    run(key, work) {
      const existing = inFlight.get(key);
      if (existing) return existing;
      const flight = (async () => {
        try {
          return await work();
        } finally {
          inFlight.delete(key);
        }
      })();
      inFlight.set(key, flight);
      return flight;
    },
    get size() {
      return inFlight.size;
    },
  };
}

function toBytes(raw: unknown): Uint8Array | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (raw instanceof Uint8Array) return raw.byteLength > 0 ? raw : undefined;
  if (raw instanceof ArrayBuffer) return raw.byteLength > 0 ? new Uint8Array(raw) : undefined;
  return undefined;
}
