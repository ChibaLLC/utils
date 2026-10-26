import type { ImagesTarget } from "./types";
import { imagesEntry, resolveImagesTarget } from "./target";

export interface ImagesNitroOptions {
  /** Overrides the target derived from the Nitro preset. */
  readonly target?: ImagesTarget;
}

/** The import specifier server code uses; the module aliases it to the target entry. */
export const IMAGES_ALIAS = "#chiballc/images";

interface NitroLike {
  options: { preset?: string; alias?: Record<string, string> };
}

/** Points `#chiballc/images` at the entry for the build's Nitro preset, so only that adapter is bundled. */
export function applyImagesAlias(nitro: NitroLike, options: ImagesNitroOptions = {}): ImagesTarget {
  const target = options.target ?? resolveImagesTarget(nitro.options.preset || process.env.NITRO_PRESET);
  nitro.options.alias = { ...nitro.options.alias, [IMAGES_ALIAS]: imagesEntry(target) };
  return target;
}

/** A Nitro module: `modules: [imagesNitroModule()]` in `nitro.config.ts`. */
export function imagesNitroModule(options: ImagesNitroOptions = {}) {
  return {
    name: "@chiballc/utils/images",
    setup(nitro: NitroLike) {
      applyImagesAlias(nitro, options);
    },
  };
}
