# @chiballc/utils/images

Runtime-agnostic image renditions: one transform interface with adapters for the Cloudflare Images binding, `ipx` (Node) and `Bun.Image` (Bun), selected by the build target through conditional exports, plus unstorage-backed cache layers.

Published as part of `@chiballc/utils`; see the [Images guide](../../docs/packages/images.md).

- `src/types.ts`, `src/limits.ts`: the interface, errors and limits shared by every target.
- `src/adapters/*`: one adapter per runtime.
- `src/layers/*`: unstorage layers per runtime; `src/cache.ts` reads and writes through them.
- `src/{core,cloudflare,node,bun}.ts`: the entries the `./images` export conditions resolve.
- `src/nitro.ts`, `src/nuxt.ts`: preset-driven aliasing for Nitro and Nuxt.

`pnpm test:images` (Node) and `pnpm test:images:bun` (Bun 1.4+) run the shared conformance suite.
