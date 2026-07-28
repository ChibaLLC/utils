# Worker Exports

Worker support is split across three package entry points. `@chiballc/utils/web-workers` manages dedicated web workers, `@chiballc/utils/service-workers` manages service-worker channels, and `@chiballc/utils/plugins` default-exports the Vite plugin. Each local example uses imports from its surrounding entry-point section.

## Web workers

```ts
import {
  createRawWorker,
  defineWRouter,
  defineWTransporter,
  terminateCachedWorker,
  useWebWorker,
} from "@chiballc/utils/web-workers";
```

### `WorkerWrapper`

`WorkerWrapper` is the type of a function that accepts optional `WorkerOptions` and returns a browser `Worker`. Vite's `?worker` imports are compatible with this shape.

```ts
const createWorker: WorkerWrapper = (options) => new SearchWorker(options);
```

### `WorkerClient`

`WorkerClient<T>` is the object returned by `useWebWorker`. It exposes the underlying read-only `worker`, `postMessage`, `sendMessage`, `sendMessages`, `onMessage`, `onError`, `release`, and `terminate` methods. The generic type is available to callers who want to describe the client message domain.

```ts
const stop = client.onMessage((event) => console.log(event.data));
const matches = await client.sendMessage<string[]>("SEARCH", { query: "nuxt" });
stop();
```

### `createRawWorker`

`createRawWorker(wrapper)` constructs a `Worker` from an existing worker, URL, string URL, Vite worker constructor, or `WorkerWrapper`. New workers are created as module workers. It returns `undefined` only when the wrapper cannot produce a worker.

```ts
createRawWorker(SearchWorker);
createRawWorker(new URL("./search.worker.ts", import.meta.url));
createRawWorker("/workers/search.js");
```

### `useWebWorker`

`useWebWorker(key, wrapper, options?)` creates or reuses a `WorkerClient`. The keyless form is `useWebWorker(wrapper, options?)`; it derives a key from the wrapper. `ephemeral` and `autoTerminateOnRelease` terminate the worker after the last client releases it. `alwaysNew` bypasses reuse and creates a unique worker. It returns `undefined` when no key or worker can be resolved.

```ts
const shared = useWebWorker("search", SearchWorker, { autoTerminateOnRelease: true });
const isolated = useWebWorker(SearchWorker, { alwaysNew: true, ephemeral: true });
shared?.release();
isolated?.release();
```

### `terminateCachedWorker`

`terminateCachedWorker(key)` terminates and removes a worker stored in the module's raw worker cache. It is safe to call when the key is not present.

```ts
terminateCachedWorker("search");
```

### `defineWTransporter`

`defineWTransporter(handler)` installs a worker-side message listener. The handler receives an object containing the incoming `type` and data, plus the original `MessageEvent`. Returning a value or promise sends `{ id, data }`; throwing sends `{ id, error }` for request messages.

```ts
defineWTransporter(({ type, query }) => {
  if (type !== "SEARCH") throw new Error("Unsupported message");
  return searchIndex(query);
});
```

### `defineWRouter`

`defineWRouter(handlers)` is a typed dispatcher built on `defineWTransporter`. It selects a handler by the incoming `type` field and warns when no handler exists.

```ts
defineWRouter({
  SEARCH: ({ query }) => searchIndex(query),
  CLEAR: () => searchIndex.clear(),
});
```

## Service workers

```ts
import {
  defineSwRouter,
  defineSwTransporter,
  getCommunicationChannels,
  useServiceWorker,
  waitForBroadcastReady,
} from "@chiballc/utils/service-workers";
```

### `AppServiceWorkerChannel`

`AppServiceWorkerChannel` is the TypeScript type of the values in the application-defined `AppServiceWorkers` interface. Augment that interface in your application when you want type-checked service-worker channel names.

```ts
declare global {
  interface AppServiceWorkers {
    Cache: "cache";
  }
}
const channel: AppServiceWorkerChannel = "cache";
```

### `waitForBroadcastReady`

`waitForBroadcastReady(registration, timeoutMs?)` resolves when a registration is active. It resolves immediately for an already active registration, otherwise listens for installation and activation. The default timeout is 30 seconds.

```ts
const registration = await navigator.serviceWorker.register("/cache-sw.js", { type: "module" });
await waitForBroadcastReady(registration, 10_000);
```

### `getCommunicationChannels`

`getCommunicationChannels(channelName)` creates the `BroadcastChannel` pair used by the protocol. It returns `requestChannel` at the provided name and `responseChannel` at `${channelName}:responses`.

```ts
const { requestChannel, responseChannel } = getCommunicationChannels("cache");
requestChannel.postMessage({ type: "WARM" });
responseChannel.addEventListener("message", ({ data }) => console.log(data));
```

### `useServiceWorker`

`useServiceWorker(url, channelName, options?)` registers the worker as a module service worker, waits for activation, and opens its broadcast channels. It returns `undefined` outside a browser main thread or when service workers are unavailable. The returned client exposes `registration`, `channelName`, `postMessage`, `sendMessage`, `sendMessages`, `onMessage`, and `close`.

```ts
const cacheWorker = await useServiceWorker("/cache-sw.js", "cache", { scope: "/" });
const status = await cacheWorker?.sendMessage<{ entries: number }>("STATUS");
cacheWorker?.close();
```

### `defineSwTransporter`

`defineSwTransporter(channelName, handler)` installs a service-worker-side listener for a channel. The handler receives the message type merged with its data and an event that adds `broadcast(type, data)`. It returns a client with `close`, or `undefined` outside a service-worker global scope.

```ts
defineSwTransporter("cache", async ({ type, url }, event) => {
  if (type !== "CACHE_URL") return;
  await caches.open("api").then((cache) => cache.add(url));
  event.broadcast("CACHE_UPDATED", { url });
  return { cached: true };
});
```

### `defineSwRouter`

`defineSwRouter(channelName, handlers)` dispatches channel messages by their `type` field. It is the multi-handler form of `defineSwTransporter` and returns the same closeable client or `undefined` outside a service worker.

```ts
defineSwRouter("cache", {
  STATUS: async () => ({ entries: (await caches.keys()).length }),
  CLEAR: async () => {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
    return { cleared: names.length };
  },
});
```

## Vite plugin

```ts
import serviceWorkerPlugin from "@chiballc/utils/plugins";
```

### `ServiceWorkerPluginOptions`

`ServiceWorkerPluginOptions` describes the plugin configuration. `appServiceWorkersEnum` supplies an optional enum for diagnostic logging. `format` is `"iife"` by default or `"es"` for native module workers. `publicDir` overrides the output directory. `logLevel` is `"info"` by default and also accepts `"silent"` and `"debug"`.

```ts
const options: ServiceWorkerPluginOptions = {
  appServiceWorkersEnum: { Cache: "cache" },
  format: "es",
  publicDir: "public",
  logLevel: "debug",
};
```

### `default: serviceWorkerPlugin`

The default export, `serviceWorkerPlugin(options?)`, returns the Vite plugin pair that implements `?serviceworker` imports. In development it transforms and serves the imported worker at a stable root URL. On build it bundles each discovered worker using the selected format and writes it to `publicDir`, the application's `public` directory, or Vite's output directory in that order.

```ts
export default defineConfig({
  plugins: [serviceWorkerPlugin({ format: "iife", logLevel: "info" })],
});

import cacheWorkerUrl from "./cache-sw.ts?serviceworker";
```
