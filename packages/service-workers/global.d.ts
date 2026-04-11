/**
 * Type declarations for ?serviceworker imports.
 *
 * When you import a file with the ?serviceworker suffix,
 * it returns a string URL that can be used to register
 * the service worker.
 *
 * @example
 * ```typescript
 * // Static import (module scope)
 * import swUrl from "./my-worker?serviceworker";
 * await navigator.serviceWorker.register(swUrl, { type: "module" });
 *
 * // Dynamic import (lazy loading) - RECOMMENDED with useServiceWorker
 * const { default: swUrl } = await import("./my-worker?serviceworker");
 * await useServiceWorker(swUrl, "my-channel");
 * ```
 */
declare module "*?serviceworker" {
  /**
   * The URL to the bundled service worker.
   * - In dev: Points to the source file served by Vite (e.g., "/app/workers/my-worker.ts")
   * - In production: Points to the bundled file at root (e.g., "/my-worker-sw.js")
   */
  const url: string;
  export default url;
}

interface SyncEvent extends ExtendableEvent {
  readonly lastChance: boolean;
  readonly tag: string;
}

interface PeriodicSyncEvent extends ExtendableEvent {
  readonly tag: string;
}

// Extend ServiceWorkerGlobalScope to include the events
interface ServiceWorkerGlobalScope {
  addEventListener(
    type: "sync",
    listener: (this: ServiceWorkerGlobalScope, ev: SyncEvent) => any,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: "periodicsync",
    listener: (this: ServiceWorkerGlobalScope, ev: PeriodicSyncEvent) => any,
    options?: boolean | AddEventListenerOptions,
  ): void;
}

interface AppServiceWorkers {}
