import { defineEventHandler } from "h3";
import { useRuntimeConfig } from "nitropack/runtime";

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event);
  const globalState = globalThis as typeof globalThis & {
    __envObserverRuntime?: Record<string, string>;
  };

  return {
    vars: event.context.vars.data,
    observerRuntime: {
      startup: globalState.__envObserverRuntime,
      request: event.context.envObserverRuntime,
    },
    runtimeConfig: {
      observerSecret: config.observerSecret,
      public: {
        observerValue: config.public.observerValue,
        observerModule: config.public.observerModule,
      },
    },
    processEnv: {
      PUBLIC_FROM_BAO: process.env.PUBLIC_FROM_BAO,
      PRIVATE_FROM_BAO: process.env.PRIVATE_FROM_BAO,
      SHARED_FROM_BAO: process.env.SHARED_FROM_BAO,
      NUXT_PUBLIC_OBSERVER_VALUE: process.env.NUXT_PUBLIC_OBSERVER_VALUE,
      NUXT_OBSERVER_SECRET: process.env.NUXT_OBSERVER_SECRET,
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    },
  };
});
