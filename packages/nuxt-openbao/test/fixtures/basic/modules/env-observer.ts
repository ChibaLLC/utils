import { addServerHandler, addServerPlugin, createResolver, defineNuxtModule } from "@nuxt/kit";

export default defineNuxtModule({
  meta: {
    name: "env-observer",
  },
  setup(_, nuxt) {
    const resolver = createResolver(import.meta.url);

    nuxt.options.runtimeConfig.public.observerModule = {
      processPublic: process.env.NUXT_PUBLIC_OBSERVER_VALUE,
      processPrivate: process.env.NUXT_OBSERVER_SECRET,
      runtimePublic: nuxt.options.runtimeConfig.public.observerValue,
      runtimePrivate: nuxt.options.runtimeConfig.observerSecret,
    };

    addServerPlugin(resolver.resolve("../observer/runtime-env-observer"));
    addServerHandler({
      route: "/api/observer-runtime",
      handler: resolver.resolve("../observer/runtime-vars"),
    });
  },
});
