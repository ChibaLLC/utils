/// <reference types="@types/webworker" />

import { defineSwRouter } from "@chiballc/utils/service-workers";
import { AppServiceWorkers } from "../service-workers";

// Simple cache for our test
const CACHE_NAME = "sw-test-cache-v2";

const self = globalThis as unknown as ServiceWorkerGlobalScope;
self.addEventListener("install", (event: any) => {
  console.log("[SW] Install");
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event: any) => {
  console.log("[SW] Activate");
  event.waitUntil(self.clients.claim());
});

// Use the library's router for high-level communication
defineSwRouter(AppServiceWorkers.Test, {
  async PING(data, event) {
    console.log("[SW] Got PING:", data);

    // Broadcast back to all tabs using the helper
    event.broadcast?.("PONG", {
      message: "Hello from the SW Router!",
      at: Date.now(),
      originalData: data,
    });

    return { success: true, timestamp: Date.now() };
  },

  async GET_INFO() {
    return {
      name: "Playground SW",
      version: "2.0.0",
      cache: CACHE_NAME,
      readyState: "full-coverage-mode",
    };
  },

  async TEST_ERROR() {
    throw new Error("This is a simulated error from the SW");
  },
});

// We can still use standard fetch listeners alongside the router
self.addEventListener("fetch", (event: any) => {
  if (event.request.url.includes("/api/sw-test")) {
    event.respondWith(
      new Response(
        JSON.stringify({
          status: "intercepted",
          timestamp: Date.now(),
          msg: "The library successfully bundled and registered me!",
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
  }
});
