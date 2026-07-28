# Worker Messaging

The worker exports provide a small request-response layer over browser workers. They are intended for applications that need more structure than raw `postMessage`, while retaining direct access to the underlying worker and its lifecycle.

## Web workers

Import web worker helpers from `@chiballc/utils/web-workers`. `useWebWorker` accepts a Vite worker constructor, a `Worker`, a `URL`, or a string URL. A key can be supplied to share the same worker client between callers.

```ts
import WorkerConstructor from "./search.worker?worker";
import { useWebWorker } from "@chiballc/utils/web-workers";

const search = useWebWorker("search", WorkerConstructor, {
  autoTerminateOnRelease: true,
});

const matches = await search?.sendMessage<string[]>("SEARCH", { query: "openbao" });
search?.release();
```

Messages sent with `sendMessage` receive an incrementing request ID. The worker returns `{ id, data }` for success or `{ id, error }` for failure. Calls reject after ten seconds unless another timeout is supplied. `postMessage` is available for messages that do not need a response, while `onMessage` and `onError` subscribe to unsolicited messages and errors.

Inside the worker, `defineWTransporter` wires a handler to this format. `defineWRouter` dispatches by `type` when the worker has several operations.

```ts
import { defineWRouter } from "@chiballc/utils/web-workers";

defineWRouter({
  SEARCH: ({ query }) => index.search(query),
});
```

By default, clients for the same key share a worker and increase its reference count. Call `release()` when a caller is finished. `autoTerminateOnRelease` or `ephemeral` terminates the worker when the final reference is released. Use `alwaysNew` only when each caller must receive an isolated worker instance.

## Service workers with Vite

The `serviceWorkerPlugin` adds `?serviceworker` imports to Vite. During development it serves each referenced worker at a stable root URL. During production builds it bundles each worker and writes it to the application's `public` directory when present, or to Vite's output directory otherwise.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { serviceWorkerPlugin } from "@chiballc/utils/plugins";

export default defineConfig({
  plugins: [serviceWorkerPlugin({ format: "es" })],
});
```

The application imports the generated root-scope URL and opens a named `BroadcastChannel` through `useServiceWorker`.

```ts
import workerUrl from "./workers/cache.ts?serviceworker";
import { useServiceWorker } from "@chiballc/utils/plugins";

const cacheWorker = await useServiceWorker(workerUrl, "cache");
const response = await cacheWorker?.sendMessage<{ cached: boolean }>("CACHE_URL", {
  url: "/api/catalog",
});
```

The service worker uses `defineSwTransporter` or `defineSwRouter` with the same channel name. A handler can return a response and can broadcast a separate event to all connected pages.

```ts
import { defineSwRouter } from "@chiballc/utils/plugins";

defineSwRouter("cache", {
  async CACHE_URL({ url }, event) {
    await caches.open("api").then((cache) => cache.add(url));
    event.broadcast("CACHE_UPDATED", { url });
    return { cached: true };
  },
});
```

Service workers are registered from the main thread only. Each worker needs a stable channel name, and callers should call `close()` when their service worker client is no longer needed so its channels and pending request timers are released.
