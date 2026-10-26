import type { RenditionCacheLayer } from "./cache";
import type { RenditionLayerOptions } from "./layer-options";
import { ImageTransformError, type ImagesTarget, type ImageTransformer, type ImageTransformerOptions } from "./types";

export * from "./shared";

/**
 * The target-neutral entry, chosen when a bundler matches no `workerd`, `bun` or `node` condition. It has the shared
 * types, limits and cache, but no adapter: import a target entry (`@chiballc/utils/images/<target>`) explicitly.
 */
export const imagesTarget: ImagesTarget | "none" = "none";

export function createImageTransformer(_options?: ImageTransformerOptions): ImageTransformer {
  throw new ImageTransformError(
    "adapter-unavailable",
    "No image adapter for this build target; import @chiballc/utils/images/cloudflare, /node or /bun",
  );
}

export function createRenditionLayers(_options: RenditionLayerOptions): RenditionCacheLayer[] {
  throw new Error("No rendition storage for this build target; import a target entry explicitly");
}
