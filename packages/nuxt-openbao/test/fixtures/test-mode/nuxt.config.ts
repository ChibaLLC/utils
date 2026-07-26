import Kibao from "../../../src/module";
import EnvObserverModule from "../basic/modules/env-observer";

export default defineNuxtConfig({
  modules: [Kibao, EnvObserverModule],
  pages: true,
  runtimeConfig: {
    observerSecret: "",
    public: {
      observerValue: "",
      observerModule: {},
    },
  },
  kibao: {
    test: {
      enabled: true,
      vars: {
        public: {
          PUBLIC_FROM_BAO: "test-public-value",
          NUXT_PUBLIC_OBSERVER_VALUE: "test-observer-public-value",
        },
        private: {
          PRIVATE_FROM_BAO: "test-private-value",
          NUXT_OBSERVER_SECRET: "test-observer-private-value",
        },
      },
    },
  },
});
