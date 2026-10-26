import type { ImagesTarget } from "./types";

export * from "./shared";
export { createIpxImageTransformer as createImageTransformer } from "./adapters/ipx";
export { createRenditionLayers } from "./layers/filesystem";

/** Selected by the `node` export condition or `@chiballc/utils/images/node`. Requires the `ipx` peer dependency. */
export const imagesTarget: ImagesTarget | "none" = "node";
