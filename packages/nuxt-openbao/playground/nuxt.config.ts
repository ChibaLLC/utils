export default defineNuxtConfig({
  modules: ["@chiballc/utils/kibao"],
  devtools: { enabled: true },
  compatibilityDate: "latest",
  kibao: {
    serverURL: "BOOOOOOOOOOOOOLLLLASLASS",
    openbao: {
      public: {
        location: {
          app: "demo",
          environment: "development",
        },
      },
      private: {
        location: {
          app: "demo",
          environment: "development",
        },
      },
    },
  },
  kibao: {
    disabled: true,
  },
});
