import type { ImagesTarget } from "./types";

export * from "./shared";
export { createBunImageTransformer as createImageTransformer } from "./adapters/bun";
export { createRenditionLayers } from "./layers/filesystem";

/** Selected by the `bun` export condition or `@chiballc/utils/images/bun`. Requires Bun 1.4 or later. */
export const imagesTarget: ImagesTarget | "none" = "bun";
