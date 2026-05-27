import MyModule from "../../../src/module";
import { PUBLIC_TOKEN_ATTESTATION } from "../../../src/runtime/utils";

const mockOpenBaoURL = process.env.MOCK_OPENBAO_URL || "";
const siteURL = process.env.NUXT_PUBLIC_SITE_URL || "";

export default defineNuxtConfig({
  modules: [MyModule],
  kibao: {
    baoServerURL: mockOpenBaoURL,
    serverURL: siteURL,
    openbao: {
      public: {
        baseURL: mockOpenBaoURL,
        location: {
          app: "demo",
          environment: "test",
        },
        token: `${PUBLIC_TOKEN_ATTESTATION}fixture-public-token`,
      },
      private: {
        baseURL: mockOpenBaoURL,
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
});
