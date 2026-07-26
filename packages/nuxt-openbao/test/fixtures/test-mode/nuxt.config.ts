import Kibao from "../../../src/module";
import { PUBLIC_TOKEN_ATTESTATION } from "../../../src/runtime/utils";
import EnvObserverModule from "../basic/modules/env-observer";

const mockOpenBaoURL = process.env.MOCK_OPENBAO_URL || "";

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
