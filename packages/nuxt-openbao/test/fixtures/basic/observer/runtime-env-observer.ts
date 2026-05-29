import { defineNitroPlugin, useRuntimeConfig } from "nitropack/runtime";

export default defineNitroPlugin((app) => {
  const config = useRuntimeConfig();
  const startup = {
    processPublic: process.env.NUXT_PUBLIC_OBSERVER_VALUE,
    processPrivate: process.env.NUXT_OBSERVER_SECRET,
    processGoogleCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    runtimePublic: config.public.observerValue,
    runtimePrivate: config.observerSecret,
  };

  (globalThis as typeof globalThis & { __envObserverRuntime?: typeof startup }).__envObserverRuntime = startup;

  app.hooks.hook("request", (event) => {
    const requestConfig = useRuntimeConfig(event);
    event.context.envObserverRuntime = {
      processPublic: process.env.NUXT_PUBLIC_OBSERVER_VALUE,
      processPrivate: process.env.NUXT_OBSERVER_SECRET,
      processGoogleCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      runtimePublic: requestConfig.public.observerValue,
      runtimePrivate: requestConfig.observerSecret,
    };
  });
});
