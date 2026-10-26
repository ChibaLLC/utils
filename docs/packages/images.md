# Images

`@chiballc/utils/images` makes small image renditions (thumbnails and previews) behind one transform interface, with an adapter per runtime and a tiered cache built on [unstorage](https://unstorage.unjs.io). It holds no application policy: callers decide who may read an image, which sizes exist and how cache keys are named.

```bash
# Cloudflare Workers
pnpm add @chiballc/utils unstorage
# Node
pnpm add @chiballc/utils unstorage ipx
# Bun 1.4 or later
pnpm add @chiballc/utils unstorage
```

## Which library does what

| Concern                 | Cloudflare Workers                                                                                                     | Node                                                     | Bun                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| Decode, resize, encode  | Workers [Images binding](https://developers.cloudflare.com/images/optimization/binding/), thin adapter in this package | [`ipx`](https://github.com/unjs/ipx) (unjs) over `sharp` | Built-in [`Bun.Image`](https://bun.com/docs/runtime/image) |
| Header probe            | Binding `info()` (not billed)                                                                                          | [`image-meta`](https://github.com/unjs/image-meta)       | `Bun.Image#metadata()`                                     |
| Fast cache layer        | Workers Cache API through an unstorage driver in this package                                                          | unstorage `lru-cache` driver                             | unstorage `lru-cache` driver                               |
| Durable rendition store | unstorage `cloudflare-r2-binding` driver                                                                               | unstorage `fs-lite` driver                               | unstorage `fs-lite` driver                                 |
| Decodes                 | JPEG, PNG, GIF (first frame), WebP, HEIC                                                                               | JPEG, PNG, GIF (first frame), WebP, AVIF, TIFF           | JPEG, PNG, GIF (first frame), WebP, BMP                    |
| Encodes                 | WebP, JPEG, AVIF                                                                                                       | WebP, JPEG, AVIF                                         | WebP, JPEG                                                 |

SVG and PDF are refused by every adapter. Bun's HEIC and AVIF support depends on operating-system codecs, so the Bun adapter refuses them on every host to give the same answer everywhere. `ipx` also runs under Bun and passes the same conformance suite; the Bun build uses `Bun.Image` because it needs no native addon.

## Selecting the target

The build target selects the adapter, never runtime detection. `@chiballc/utils/images` has conditional exports, so a bundler picks the entry for the target it builds:

| Condition | Entry                               | Typical bundler                                               |
| --------- | ----------------------------------- | ------------------------------------------------------------- |
| `workerd` | `@chiballc/utils/images/cloudflare` | Wrangler, `@cloudflare/vite-plugin`, Nitro Cloudflare presets |
| `bun`     | `@chiballc/utils/images/bun`        | Bun                                                           |
| `node`    | `@chiballc/utils/images/node`       | Node, Nitro Node presets                                      |
| `default` | `@chiballc/utils/images/core`       | Anything else; types, limits and cache only, no adapter       |

Every entry exports the same names (`createImageTransformer`, `createRenditionLayers`, `createRenditionCache`, the limits and the error type), so application code does not change between targets. Import a target entry directly to override the condition, for example in a test or an unusual build. Each entry is bundled separately: the Workers entry can never reach `sharp`, `ipx` or a Node built-in, and `scripts/validate-images.mjs` fails the build if it does.

### Nuxt and Nitro

For Nitro-based apps, the module aliases `#chiballc/images` to the entry for the Nitro preset (`cloudflare*` presets to Cloudflare, `bun` to Bun, Node-family presets to Node). Edge presets with no adapter, such as `vercel-edge` or Deno, are refused at build time instead of silently bundling `sharp`.

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@chiballc/utils/images/nuxt"],
  // Optional override; the preset decides by default.
  imageRenditions: { target: "node" },
});
```

```ts
// nitro.config.ts
import { imagesNitroModule } from "@chiballc/utils/images/nitro";

export default defineNitroConfig({ modules: [imagesNitroModule()] });
```

Server code then imports from `#chiballc/images`.

## Transforming

```ts
import { createImageTransformer, ImageTransformError } from "@chiballc/utils/images";

const images = createImageTransformer({ binding: env.IMAGES }); // `binding` is read by the Cloudflare entry only

if (images.supports(mediaType)) {
  try {
    const rendition = await images.transform(stream, { width: 640, format: "webp", quality: 75 });
    // rendition.body, rendition.contentType, rendition.width, rendition.height, rendition.source
  } catch (error) {
    if (error instanceof ImageTransformError && error.permanent) {
      // Record the source as unsupported; retrying cannot succeed.
    }
    throw error;
  }
}
```

`transform` reads the input (a stream, `Uint8Array` or `ArrayBuffer`), probes its header, enforces every limit and only then decodes. `fit` is always `inside`: the output keeps the aspect ratio, fits within `width` x `height` (default a square) and is never enlarged. Crop for display in CSS.

## Limits

| Limit                | Default | Enforced                                                                    |
| -------------------- | ------- | --------------------------------------------------------------------------- |
| `maxInputBytes`      | 20 MiB  | While the input is read; matches the Images binding input cap               |
| `maxInputPixels`     | 50 MP   | From the header, before any pixel buffer is allocated (decompression bombs) |
| `maxInputDimension`  | 12,000  | From the header                                                             |
| `maxOutputDimension` | 2,048   | On the requested box                                                        |
| `maxOutputBytes`     | 2 MiB   | On the encoded output                                                       |

Override any of them with `createImageTransformer({ limits: { maxInputPixels: 25_000_000 } })`. Errors carry a `code` (`input-too-large`, `too-many-pixels`, `dimension-too-large`, `invalid-options`, `unsupported-format`, `decode-failed`, `output-too-large`, `adapter-unavailable`, `transform-failed`) and `permanent`, which is false only for failures a retry might fix.

## Caching

`createRenditionLayers` returns the target's unstorage layers, fastest first, and `createRenditionCache` reads and writes through them:

```ts
import { createRenditionCache, createRenditionLayers } from "@chiballc/utils/images";

// Workers: Cache API, then R2. Node and Bun: in-process LRU, then a directory.
const cache = createRenditionCache({
  layers: createRenditionLayers({ r2: env.RENDITIONS, directory: "/var/lib/app/renditions" }),
  defer: (work) => ctx.waitUntil(work), // refill the edge in the background on Workers
});

const { bytes, layer } = await cache.getOrCreate(key, async () => (await images.transform(source(), spec)).body);
```

- A read returns the fastest layer that has the key and refills the faster layers it missed. `layer` names the layer that answered (`edge`, `r2`, `memory`, `disk`) or `created`, which is enough to measure hit rates.
- A write goes to the durable layer first, so a fast layer never holds bytes the durable layer lacks.
- `getOrCreate` is single-flight per key within a process: concurrent misses share one transform. Coordinate across processes or isolates in the caller (for example with a database lease); the cache does not.
- Keys are opaque. Build them from immutable identity (item, version, size and the source validator) so a key never names two byte strings. The Workers edge driver stores entries under an internal URL (`https://renditions.cache.internal/...` by default) that the Worker never serves, so the cache is reachable only through code that already holds the key. Access control belongs in the caller, before the cache is consulted.
- A failing fast layer is treated as a miss; a failing durable layer surfaces to the caller.

## Self-hosting with Node or Bun

Install the target's dependencies above, then use the same code with a directory instead of an R2 binding:

```ts
import { createImageTransformer, createRenditionCache, createRenditionLayers } from "@chiballc/utils/images";

const images = createImageTransformer();
const cache = createRenditionCache({
  layers: createRenditionLayers({ directory: process.env.RENDITIONS_DIR!, memory: { maxBytes: 64 * 1024 * 1024 } }),
});
```

Node resolves the `node` entry (ipx); `bun run` resolves the `bun` entry (`Bun.Image`, Bun 1.4 or later). A bundler targeting Node must keep `ipx` and `sharp` external so sharp's platform binary loads at run time.

## Cloudflare billing

Each distinct source image and parameter set transformed through the binding counts once per calendar month as a unique transformation; `info()` is free. The Images Free plan includes 5,000 unique transformations a month and then refuses new ones with error 9422 (reported as `transform-failed`, not permanent). The Paid plan bills $0.50 per 1,000 beyond the first 5,000. Store renditions durably so each one is transformed once; the binding does not cache its output.

## Tests

`pnpm test:images` runs the adapter conformance suite for ipx and for the Cloudflare adapter against a sharp-backed mock of the binding, the cache and target tests, then `scripts/validate-images.mjs` on the build. `pnpm test:images:bun` runs the same conformance cases under Bun for `Bun.Image` and for ipx.
