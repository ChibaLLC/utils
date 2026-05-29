import { defineEventHandler } from "h3";
import { useRuntimeConfig } from "nitropack/runtime";

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event);

  return {
    vars: event.context.vars.data,
    processEnv: {
      PUBLIC_FROM_BAO: process.env.PUBLIC_FROM_BAO,
      PRIVATE_FROM_BAO: process.env.PRIVATE_FROM_BAO,
      NUXT_PUBLIC_OBSERVER_VALUE: process.env.NUXT_PUBLIC_OBSERVER_VALUE,
      NUXT_OBSERVER_SECRET: process.env.NUXT_OBSERVER_SECRET,
    },
    runtimeConfig: {
      observerSecret: config.observerSecret,
      public: {
        observerValue: config.public.observerValue,
      },
    },
  };
});
