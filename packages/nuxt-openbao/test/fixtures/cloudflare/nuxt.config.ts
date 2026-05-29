import MyModule from "../../../src/module";
import { PUBLIC_TOKEN_ATTESTATION } from "../../../src/runtime/utils";
import EnvObserverModule from "../basic/modules/env-observer";

const mockOpenBaoURL = process.env.MOCK_OPENBAO_URL || "";

export default defineNuxtConfig({
  modules: [MyModule, EnvObserverModule],
  runtimeConfig: {
    observerSecret: "",
    public: {
      observerValue: "",
      observerModule: {},
    },
  },
  nitro: {
    preset: "cloudflare_module",
  },
  kibao: {
    server: {
      bao: mockOpenBaoURL,
    },
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
