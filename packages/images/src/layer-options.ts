/** The part of an R2 bucket binding the durable Workers layer uses. */
export interface R2BucketLike {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown, options?: unknown): Promise<unknown>;
  head(key: string): Promise<unknown>;
  delete(keys: string | string[]): Promise<unknown>;
  list(options?: unknown): Promise<unknown>;
}

/** The part of a Workers `Cache` the edge layer uses. */
export interface EdgeCacheLike {
  match(request: string): Promise<Response | undefined>;
  put(request: string, response: Response): Promise<void>;
  delete(request: string): Promise<boolean>;
}

/**
 * One options shape for every target; each target reads the fields it needs and ignores the rest, so a consumer's
 * configuration type-checks the same whichever adapter the build selects.
 */
export interface RenditionLayerOptions {
  /** Key prefix inside the durable store. @default "renditions" */
  readonly base?: string;
  /** Cloudflare: the R2 bucket binding that holds the durable copy. */
  readonly r2?: R2BucketLike;
  /** Cloudflare: the Cache API edge layer, or `false` to skip it. */
  readonly edge?: false | { readonly cache?: EdgeCacheLike; readonly origin?: string; readonly maxAgeSeconds?: number };
  /** Node and Bun: the directory that holds the durable copy. */
  readonly directory?: string;
  /** Node and Bun: the in-process LRU layer, or `false` to skip it. */
  readonly memory?: false | { readonly maxEntries?: number; readonly maxBytes?: number };
}
