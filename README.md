# Chiba LLC Utils

TypeScript utilities, browser worker messaging, and the Kibao Nuxt module for OpenBao-backed runtime configuration.

## Installation

```bash
pnpm add @chiballc/utils
```

Import core helpers from the package root. Worker and Nuxt entry points use explicit subpaths.

```ts
import { execute, LRUCache } from "@chiballc/utils";
import { useWebWorker } from "@chiballc/utils/web-workers";
import { useServiceWorker } from "@chiballc/utils/service-workers";
import serviceWorkerPlugin from "@chiballc/utils/plugins";
```

Kibao is bundled with the root package. Register it in Nuxt from `@chiballc/utils/kibao`; runtime helpers are available from `@chiballc/utils/kibao/runtime`.

```ts
export default defineNuxtConfig({
  modules: ["@chiballc/utils/kibao"],
});
```

Image renditions are available from `@chiballc/utils/images`. Conditional exports select the Cloudflare Images binding, `ipx` (Node) or `Bun.Image` (Bun) adapter by build target, with unstorage-backed cache layers; `@chiballc/utils/images/nuxt` registers it for Nitro presets. See [Images](https://chiballc.github.io/utils/packages/images).

Full API documentation, examples, lifecycle behavior, and the OpenBao security model are available at [chiballc.github.io/utils](https://chiballc.github.io/utils/).

## Documentation

The documentation site uses VitePress.

```bash
pnpm install
pnpm docs:dev
```

`pnpm docs:build` writes the production site to `docs/.vitepress/dist`. Use `pnpm docs:preview` to serve that built output locally.

## GitHub Pages

`.github/workflows/deploy-docs.yml` builds and deploys the documentation when documentation files, `package.json`, or `pnpm-lock.yaml` change on `main`. It uses GitHub Pages artifacts, so no generated files or `gh-pages` branch are committed.

In the repository's GitHub settings, open **Pages** and select **GitHub Actions** as the publishing source. The site is configured for the project-site path `https://chiballc.github.io/utils/`. If it moves to a custom domain or an organization root site, update `base` in `docs/.vitepress/config.mts`.

## License

ISC
