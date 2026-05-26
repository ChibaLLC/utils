export default defineNuxtConfig({
  modules: ["@chiballc/utils/kibao"],
  devtools: { enabled: true },
  compatibilityDate: "latest",
  kibao: {
    serverURL: process.env.NUXT_PUBLIC_SITE_URL,
    openbao: {
      public: {
        location: {
          app: process.env.NUXT_KIBAO_OPENBAO_PUBLIC_LOCATION_APP || "demo",
          environment: process.env.NUXT_KIBAO_OPENBAO_PUBLIC_LOCATION_ENVIRONMENT || "development",
          path: process.env.NUXT_KIBAO_OPENBAO_PUBLIC_LOCATION_PATH,
        },
        namespace: process.env.NUXT_KIBAO_OPENBAO_PUBLIC_NAMESPACE,
        token: process.env.NUXT_KIBAO_OPENBAO_PUBLIC_TOKEN,
      },
      private: {
        location: {
          app: process.env.NUXT_KIBAO_OPENBAO_PRIVATE_LOCATION_APP || "demo",
          environment: process.env.NUXT_KIBAO_OPENBAO_PRIVATE_LOCATION_ENVIRONMENT || "development",
          path: process.env.NUXT_KIBAO_OPENBAO_PRIVATE_LOCATION_PATH,
        },
        namespace: process.env.NUXT_KIBAO_OPENBAO_PRIVATE_NAMESPACE,
        token: process.env.NUXT_KIBAO_OPENBAO_PRIVATE_TOKEN,
        bao: {
          role: {
            id: process.env.NUXT_KIBAO_OPENBAO_PRIVATE_BAO_ROLE_ID,
          },
          secret: {
            id: process.env.NUXT_KIBAO_OPENBAO_PRIVATE_BAO_SECRET_ID,
          },
        },
      },
    },
  },
});
