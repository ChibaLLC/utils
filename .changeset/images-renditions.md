---
"@chiballc/utils": minor
---

Add `@chiballc/utils/images`: a runtime-agnostic image rendition module. One `ImageTransformer` interface with adapters for the Cloudflare Workers Images binding, `ipx` on Node and `Bun.Image` on Bun, selected by build target through `workerd`/`bun`/`node` export conditions (or explicit `/cloudflare`, `/node`, `/bun` entries), header probing with input, pixel, dimension and output limits, unstorage-backed cache layers (Workers Cache API and R2, or LRU and disk) with single-flight creation, and Nuxt/Nitro modules that alias `#chiballc/images` from the Nitro preset. `ipx` and `unstorage` are optional peer dependencies.
