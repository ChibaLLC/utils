import MyModule from "../../../src/module";
import { PUBLIC_TOKEN_ATTESTATION } from "../../../src/runtime/utils";

export default defineNuxtConfig({
  modules: [
    [
      MyModule,
      {
        baoServerURL: process.env.MOCK_OPENBAO_URL,
        serverURL: process.env.NUXT_PUBLIC_SITE_URL,
        openbao: {
          public: {
            baseURL: process.env.MOCK_OPENBAO_URL,
            location: {
              app: "demo",
              environment: "test",
            },
            token: `${PUBLIC_TOKEN_ATTESTATION}fixture-public-token`,
          },
          private: {
            baseURL: process.env.MOCK_OPENBAO_URL,
            location: {
              app: "demo",
              environment: "test",
            },
            bao: {
              role: {
                id: "fixture-role-id",
              },
              secret: {
                id: "fixture-secret-id",
              },
            },
          },
        },
      },
    ] as any,
  ],
});
