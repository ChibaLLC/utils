import Kibao from "../../../src/module";
import { PUBLIC_TOKEN_ATTESTATION } from "../../../src/runtime/utils";

const mockOpenBaoURL = process.env.MOCK_OPENBAO_URL || "";

export default defineNuxtConfig({
  modules: [[Kibao, { serverOnly: true }]],
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
        location: { app: "demo", environment: "test" },
        token: `${PUBLIC_TOKEN_ATTESTATION}fixture-public-token`,
      },
    },
  },
});
