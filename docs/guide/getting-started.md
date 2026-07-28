# Getting Started

This repository publishes utilities for TypeScript applications, browser worker communication, and a Nuxt module named Kibao. The root package is the usual starting point.

```bash
pnpm add @chiballc/utils
```

Import the helpers you need from the package root. The library is ESM-first and includes TypeScript declarations.

```ts
import { execute, LRUTimeCache, toMilliSeconds } from "@chiballc/utils";

const cache = new LRUTimeCache<string, string>(100);
cache.set("profile:42", "available", toMilliSeconds(5, "min"));

const { result, error } = await execute(fetch("/api/profile/42").then((response) => response.json()));

if (error) {
  throw error;
}

console.log(result);
```

The `execute` helper turns a synchronous function, asynchronous function, value, or promise into an object with `result` and `error` properties. This is useful at application boundaries where handling an expected failure locally is clearer than relying on nested `try`/`catch` blocks.

## Worker entry points

Worker helpers are intentionally separate from the core entry point. Import web worker support from `@chiballc/utils/web-workers`, the service worker runtime from `@chiballc/utils/service-workers`, and the default Vite plugin from `@chiballc/utils/plugins`.

```ts
import { useWebWorker } from "@chiballc/utils/web-workers";
import { useServiceWorker } from "@chiballc/utils/service-workers";
import serviceWorkerPlugin from "@chiballc/utils/plugins";
```

See [Worker Messaging](/packages/workers) for the messaging contract and lifecycle behavior.

## Kibao for Nuxt

Kibao is bundled into this package. Add `@chiballc/utils` to a Nuxt application, then register the `@chiballc/utils/kibao` module entry point. The [Kibao guide](/packages/kibao) explains the public/private boundary and request safeguards.
