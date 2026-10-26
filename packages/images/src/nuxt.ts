import { defineNuxtModule } from "@nuxt/kit";
import { applyImagesAlias, type ImagesNitroOptions } from "./nitro";

export { IMAGES_ALIAS } from "./nitro";
export type { ImagesNitroOptions } from "./nitro";

/** The module's public shape, declared structurally so its types do not depend on resolving `@nuxt/schema`. */
interface NitroConfigLike {
  preset?: string;
  alias?: Record<string, string>;
}

export interface ImagesNuxtModule {
  (options: ImagesNitroOptions, nuxt: never): unknown;
}

/**
 * Registers `#chiballc/images` for Nitro server code, resolved from the Nitro preset at build time. Configure with the
 * `imageRenditions` key, e.g. `imageRenditions: { target: "bun" }`, only to override the preset.
 */
const imagesNuxtModule: ImagesNuxtModule = defineNuxtModule<ImagesNitroOptions>({
  meta: { name: "@chiballc/utils/images", configKey: "imageRenditions" },
  setup(options, nuxt) {
    // `nitro` is declared by Nitro's own augmentation of the Nuxt schema, which this package does not load.
    const nitro = ((nuxt.options as { nitro?: NitroConfigLike }).nitro ??= {});
    const config = { options: { ...(nitro.preset ? { preset: nitro.preset } : {}), alias: nitro.alias ?? {} } };
    applyImagesAlias(config, options);
    nitro.alias = config.options.alias;
  },
});

export default imagesNuxtModule;
