export default defineNuxtConfig({
  extends: ["../basic"],
  kibao: {
    test: {
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
