## Vite service worker plugin

Typed Vite plugin for managing `?serviceworker` imports, building your workers to the app’s public scope, and communicating with them via `BroadcastChannel`.

### Installation

Assuming you already depend on `@chiballc/utils`:

```bash
pnpm add @chiballc/utils
```

After `pnpm build` in this repo, the plugin is exposed from the `./plugins` export:

```ts
import { serviceWorkerPlugin } from "@chiballc/utils/plugins";
```

### 1. Define your enum and global augmentation (in your app)

```ts
// app/service-workers.ts
export enum AppServiceWorkers {
  BackupSync = "backup-sync",
  // add more as needed
}
```

```ts
// app/globals.d.ts
declare global {
  interface AppServiceWorkers {
    BackupSync: AppServiceWorkers.BackupSync;
  }
}
```

The package ships `packages/plugins/service-worker/global.d.ts`, which:

- Adds `declare module "*?serviceworker"` → `string`
- Declares an empty `interface AppServiceWorkers {}` that you augment as above

### 2. Configure the plugin in `vite.config.ts`

```ts
import { defineConfig } from "vite";
import { serviceWorkerPlugin } from "@chiballc/utils/plugins";
import { AppServiceWorkers } from "./app/service-workers";

export default defineConfig({
  plugins: [
    serviceWorkerPlugin({
      appServiceWorkersEnum: AppServiceWorkers,
      format: "iife", // or "es"
      // publicDir?: string; // defaults to <root>/public or build.outDir
      // logLevel?: "silent" | "info" | "debug";
    }),
  ],
});
```

### 3. Author a service worker and register it

```ts
// app/workers/backup-sync.ts (service worker)
import { defineSwTransporter } from "@chiballc/utils/plugins";
import { AppServiceWorkers } from "../service-workers";

defineSwTransporter(AppServiceWorkers.BackupSync, async (data, event) => {
  if (data.type === "PING") {
    event.broadcast("PONG", { at: Date.now() });
    return { ok: true };
  }
});
```

```ts
// app/backup-sync-client.ts (browser)
import swUrl from "./workers/backup-sync?serviceworker";
import { useServiceWorker } from "@chiballc/utils/plugins";
import { AppServiceWorkers } from "./service-workers";

const sw = await useServiceWorker(swUrl, AppServiceWorkers.BackupSync);

// fire-and-forget
sw.postMessage({ type: "PING" });

// request/response
const result = await sw.sendMessage<{ ok: boolean }>("PING");
```

### 4. Build behavior

- **Dev**:
  - `import "./worker?serviceworker"` resolves to a string URL like `"/backup-sync-sw.js"`.
  - A dev middleware serves the transformed worker script from that root URL using Vite’s `transformRequest`.
- **Build**:
  - The plugin bundles each referenced worker using an internal Vite build in `lib` mode.
  - Output is written to:
    - `options.publicDir` if provided, or
    - `<config.root>/public` if that directory exists, otherwise
    - `<config.root>/<config.build.outDir>`.
  - Filenames are stable, e.g. `backup-sync-sw.js` or `<parent>-sw.js` when the source file is `index.ts`.

### Options reference

```ts
export interface ServiceWorkerPluginOptions {
  appServiceWorkersEnum?: Record<string, string | number>;
  format?: "iife" | "es"; // default "iife"
  publicDir?: string;
  logLevel?: "silent" | "info" | "debug";
}
```

