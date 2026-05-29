const app = process.env.NUXT_KIBAO_OPENBAO_PUBLIC_LOCATION_APP || "demo";
const environment = process.env.NUXT_KIBAO_OPENBAO_PUBLIC_LOCATION_ENVIRONMENT || "development";

export default defineNuxtConfig({
  modules: ["@chiballc/utils/kibao"],
  devtools: { enabled: true },
  compatibilityDate: "latest",
  kibao: {
    server: {
      base: process.env.NUXT_PUBLIC_SITE_URL || "http://localhost:3000",
      bao: process.env.NUXT_KIBAO_SERVER_BAO || "http://127.0.0.1:8200",
    },
    openbao: {
      public: {
        location: {
          app,
          environment,
        },
      },
      private: {
        location: {
          app: process.env.NUXT_KIBAO_OPENBAO_PRIVATE_LOCATION_APP || app,
          environment: process.env.NUXT_KIBAO_OPENBAO_PRIVATE_LOCATION_ENVIRONMENT || environment,
        },
      },
    },
  },
});
