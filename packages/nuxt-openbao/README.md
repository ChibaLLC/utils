<!--
Get your module up and running quickly.

Find and replace all on all files (CMD+SHIFT+F):
- Name: My Module
- Package name: my-module
- Description: My new Nuxt module
-->

# My Module

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

My new Nuxt module for doing amazing things.

- [✨ &nbsp;Release Notes](/CHANGELOG.md)
<!-- - [🏀 Online playground](https://stackblitz.com/github/your-org/my-module?file=playground%2Fapp.vue) -->
<!-- - [📖 &nbsp;Documentation](https://example.com) -->

## Features

<!-- Highlight some of the features your module provide here -->
- ⛰ &nbsp;Foo
- 🚠 &nbsp;Bar
- 🌲 &nbsp;Baz

## Bounded Runtime Reads

`getSecrets`, `getKibaoHeaders`, and `getKibaoToken` accept `KibaoRequestOptions`. Pass a caller-owned `AbortSignal` to cancel the complete AppRole login and secret-read chain. Responses are streamed, limited to 64 KiB by default before JSON parsing, and never retried by Kibao.

```ts
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 2_000)

try {
  await getSecrets(credentials, "private", { signal: controller.signal })
} finally {
  clearTimeout(timeout)
}
```

Kibao limits each response to 64 KiB by default. Set `maxResponseBytes` when an application has a justified larger configuration payload; callers remain responsible for choosing a bounded value. Transport failures are value-free `KibaoRequestError` messages and do not include credentials, tokens, URLs, or response bodies.

## Quick Setup

Install the module to your Nuxt application with one command:

```bash
npx nuxt module add my-module
```

That's it! You can now use My Module in your Nuxt app ✨

## Test Fixtures

Set `kibao.test.enabled` to activate `kibao.test.vars`:

```ts
export default defineNuxtConfig({
  kibao: {
    test: {
      enabled: true,
      vars: {
        public: { NUXT_PUBLIC_API_ORIGIN: "https://example.test" },
        private: { API_TOKEN: "synthetic-test-token" },
      },
    },
  },
});
```

Fixtures inject these synthetic values without contacting OpenBao. Browser code treats them as already loaded and does not use `/bao-proxy/**`; private fixture values are never added to public runtime config. When `enabled` is not `true`, Kibao ignores `test.vars` and uses its normal OpenBao path. Never enable fixture values for a deployed application.


## Contribution

<details>
  <summary>Local development</summary>
  
  ```bash
  # Install dependencies
  npm install
  
  # Generate type stubs
  npm run dev:prepare
  
  # Develop with the playground
  npm run dev
  
  # Build the playground
  npm run dev:build
  
  # Run ESLint
  npm run lint
  
  # Run Vitest
  npm run test
  npm run test:watch
  
  # Release new version
  npm run release
  ```

</details>


<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/my-module/latest.svg?style=flat&colorA=020420&colorB=00DC82
[npm-version-href]: https://npmjs.com/package/my-module

[npm-downloads-src]: https://img.shields.io/npm/dm/my-module.svg?style=flat&colorA=020420&colorB=00DC82
[npm-downloads-href]: https://npm.chart.dev/my-module

[license-src]: https://img.shields.io/npm/l/my-module.svg?style=flat&colorA=020420&colorB=00DC82
[license-href]: https://npmjs.com/package/my-module

[nuxt-src]: https://img.shields.io/badge/Nuxt-020420?logo=nuxt
[nuxt-href]: https://nuxt.com
