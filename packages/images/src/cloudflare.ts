import type { ImagesTarget } from "./types";

export * from "./shared";
export { createCloudflareImageTransformer as createImageTransformer } from "./adapters/cloudflare";
export { cloudflareCacheApiDriver, createRenditionLayers } from "./layers/cloudflare";

/** Selected by the `workerd` export condition or `@chiballc/utils/images/cloudflare`. */
export const imagesTarget: ImagesTarget | "none" = "cloudflare";
