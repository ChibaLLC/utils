/// <reference types="@types/webworker" />

import type { Values } from "@chiballc/types";
import { isServiceWorker, isWorker } from "@utils/env";
import { ulid } from "ulid";
import { consola } from "consola";
import { hasWindow } from "std-env";

/**
 * Wait for a service worker to be ready
 */
export function waitForBroadcastReady(registration: ServiceWorkerRegistration, timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    // Fast path
    console.debug("registration.active?.state", registration.active?.state);
    if (registration.active?.state === "activated") {
      resolve();
      return;
    }

    let timeoutId: number | undefined;

    const cleanup = () => {
      clearTimeout(timeoutId);
      registration.removeEventListener("updatefound", onUpdateFound);
    };

    const onActivated = (sw: ServiceWorker, event: Event) => {
      console.debug("Service worker state change", event);
      if (sw.state === "activated") {
        cleanup();
        console.debug("Service worker activated");
        resolve();
      }
    };

    const onUpdateFound = () => {
      const sw = registration.installing;
      if (!sw) return;

      sw.addEventListener("statechange", (event) => onActivated(sw, event));
    };

    registration.addEventListener("updatefound", onUpdateFound);

    timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for service worker activation"));
    }, timeoutMs);
  });
}

export function getCommunicationChannels(channelName: string) {
  const console = consola.withTag("service-worker");
  const requestChannel = new BroadcastChannel(channelName);
  const responseChannel = new BroadcastChannel(`${channelName}:responses`);
  requestChannel.addEventListener("message", (event: MessageEvent) => {
    console.withTag("requestChannel").debug(event.data);
  });
  responseChannel.addEventListener("message", (event: MessageEvent) => {
    console.withTag("responseChannel").debug(event.data);
  });
  return { requestChannel, responseChannel };
}

/**
 * Register and communicate with a service worker using BroadcastChannel.
 * Works from ANY tab, even before the SW takes control!
 *
 * @example
 * const sw = await useServiceWorker('/sw.js', 'my-app');
 *
 * // Request-response
 * const status = await sw.sendMessage('GET_STATUS');
 *
 * // Fire-and-forget
 * sw.postMessage({ type: 'LOG', message: 'hello' });
 *
 * // Listen for broadcasts
 * const unsub = sw.onMessage((event) => {
 *   if (event.data.type === 'CACHE_UPDATED') {
 *     console.log('Cache updated!');
 *   }
 * });
 */
export async function useServiceWorker(_url: string | URL, channelName: string, options?: RegistrationOptions) {
  const console = consola.withTag("service-worker").withTag("useServiceWorker");
  if (isWorker) {
    console.error("Service workers can only be registered from the main thread");
    return;
  }

  // The URL from ?serviceworker import is already an absolute path (e.g., "/my-sw.js")
  // Don't use import.meta.url as base - it would incorrectly resolve relative to the current module
  const url = typeof _url === "string" ? _url : _url.href;

  if (hasWindow) {
    if (!navigator.serviceWorker) {
      console.error("ServiceWorker not supported");
      return;
    }
    // Register service worker
    const registration =
      (await navigator.serviceWorker.getRegistration(url).catch(() => undefined)) ||
      (await navigator.serviceWorker.register(url, {
        type: "module",
        ...options,
      }));

    // Wait for SW to be ready
    await waitForBroadcastReady(registration)
      .then(() => {
        console.success(`Service worker ready for ${url}`);
      })
      .catch((e) => {
        console.error(`Service worker failed to activate for ${url}`, e);
      });

    // Create BroadcastChannels for communication
    const { requestChannel, responseChannel } = getCommunicationChannels(channelName);
    const pendingRequests = new Map<
      string,
      {
        resolve: (value: any) => void;
        reject: (error: Error) => void;
        timeout: any;
      }
    >();
    const messageHandlers = new Set<(event: MessageEvent) => void>();

    // Listen for responses from SW
    responseChannel.addEventListener("message", (event: MessageEvent) => {
      const { id, data, error } = event.data;

      // Handle request responses
      if (id !== undefined && pendingRequests.has(id)) {
        const pending = pendingRequests.get(id)!;
        pendingRequests.delete(id);
        clearTimeout(pending.timeout);

        if (error) {
          pending.reject(new Error(error));
        } else {
          pending.resolve(data);
        }
        return;
      }

      // Pass broadcasts to message handlers
      messageHandlers.forEach((handler) => handler(event));
    });

    return {
      get registration() {
        return registration;
      },

      get channelName() {
        return channelName;
      },

      postMessage(message: any) {
        requestChannel.postMessage(message);
      },

      onMessage(callback: (event: MessageEvent) => void) {
        messageHandlers.add(callback);

        return () => {
          messageHandlers.delete(callback);
        };
      },

      async sendMessage<T = any, D = any>(type: string, data?: D, timeoutMs: number = 10000): Promise<T> {
        const id = ulid();

        return new Promise<T>((resolve, reject) => {
          const timeout = setTimeout(() => {
            pendingRequests.delete(id);
            reject(new Error(`Service worker response timeout after ${timeoutMs}ms`));
          }, timeoutMs);

          pendingRequests.set(id, { resolve, reject, timeout });

          requestChannel.postMessage({ id, type, data });
        });
      },

      async sendMessages<T = any>(messages: Array<{ type: string; data?: any }>, timeoutMs?: number): Promise<T[]> {
        return Promise.all(messages.map((msg) => this.sendMessage<T>(msg.type, msg.data, timeoutMs)));
      },

      close() {
        pendingRequests.forEach(({ timeout }) => clearTimeout(timeout));
        pendingRequests.clear();
        messageHandlers.clear();
        requestChannel.close();
        responseChannel.close();
      },
    };
  }

  return Promise.resolve(undefined);
}

interface SWMessageEvent extends MessageEvent {
  broadcast?: (type: string, data: any) => void;
  waitUntil?: (promise: Promise<void>) => void;
}
type TransporterHandler<T = any, R = any> = (data: T, event: SWMessageEvent) => R | Promise<R> | void | Promise<void>;

/**
 * Create a message handler for service workers using BroadcastChannel.
 * Automatically manages request-response and broadcast patterns.
 *
 * @example
 * const broker = defineTransporter(AppServiceWorkers.firebaseMessaging, async (data, event) => {
 *   if (data.type === 'CACHE_URL') {
 *     await cache.add(data.url);
 *
 *     // Broadcast to all tabs
 *     event.broadcast('CACHE_UPDATED', { url: data.url });
 *
 *     return { cached: true };
 *   }
 * });
 */

export function defineSwTransporter<T = any, R = any>(
  channelName: Values<AppServiceWorkers>,
  handler: TransporterHandler<T, R>,
) {
  const console = consola.withTag("service-worker").withTag("defineSwTransporter");
  if (!handler) {
    throw new Error("Handler is required when using BroadcastChannel mode");
  }

  if (!isServiceWorker) {
    console.warn("defineSwRouter can only be used in service workers, did you mean defineWTransporter?");
    return;
  }

  const { requestChannel, responseChannel } = getCommunicationChannels(channelName);
  requestChannel.addEventListener("message", async (event: MessageEvent) => {
    console.debug(event.data);
    const { id, type, data } = event.data;

    try {
      // Add broadcast helper to event
      const enhancedEvent = {
        ...event,
        broadcast: (broadcastType: string, broadcastData: any) => {
          responseChannel.postMessage({
            type: broadcastType,
            data: broadcastData,
          });
        },
      } as MessageEvent & { broadcast: (type: string, data: any) => void };

      const result = await handler({ type, ...data }, enhancedEvent);

      // Send response if we have a request ID
      if (result !== undefined && id !== undefined) {
        responseChannel.postMessage({ id, data: result });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      if (id !== undefined) {
        responseChannel.postMessage({ id, error: errorMessage });
      }
    }
  });

  return {
    close() {
      requestChannel.close();
      responseChannel.close();
    },
  };
}

/**
 * Create a message router for service workers.
 * Routes messages by type to different handlers.
 *
 * @example
 * // Service worker with BroadcastChannel:
 * const router = defineRouter('my-app', {
 *   'GET_STATUS': async (data, event) => {
 *     return { status: 'active' };
 *   },
 *
 *   'CACHE_URL': async (data, event) => {
 *     await cache.add(data.url);
 *
 *     // Broadcast to all tabs
 *     event.broadcast('CACHE_UPDATED', { url: data.url });
 *
 *     return { cached: true };
 *   },
 *
 *   'CLEAR_CACHE': async (data, event) => {
 *     const names = await caches.keys();
 *     await Promise.all(names.map(n => caches.delete(n)));
 *
 *     event.broadcast('CACHE_CLEARED', { count: names.length });
 *
 *     return { cleared: names.length };
 *   }
 * });
 */
export function defineSwRouter<T extends { type: string } = { type: string }>(
  channelName: Values<AppServiceWorkers>,
  handlers: Record<string, TransporterHandler<any, any>>,
) {
  if (!handlers) {
    throw new Error("Handlers are required when using BroadcastChannel mode");
  }
  return defineSwTransporter(channelName, async (data: T, event) => {
    const handler = handlers[data.type];

    if (!handler) {
      console.warn(`No handler found for message type: ${data.type}`);
      return;
    }

    return await handler(data, event);
  });
}

export type AppServiceWorkerChannel = Values<AppServiceWorkers>;
