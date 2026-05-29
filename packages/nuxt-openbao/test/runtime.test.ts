import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "std-env";
import {
  PRIVATE_TOKEN_ATTESTATION,
  PUBLIC_TOKEN_ATTESTATION,
  getAllVars,
  getKibaoHeaders,
  getKibaoToken,
  getSecrets,
} from "../src/runtime/utils";
import { applyRuntimeConfigEnv, crawlVarsFromEnv, getEnvSereverURL, reconsileConfig, setEnv } from "../src/runtime/env";
import { createMockOpenBaoServer, type MockOpenBaoServer } from "./helpers/openbao";

describe("OpenBao runtime helpers", () => {
  let openbao: MockOpenBaoServer;
  const envSnapshot = { ...process.env };

  beforeEach(async () => {
    process.env = { ...envSnapshot };
    openbao = await createMockOpenBaoServer();
  });

  afterEach(async () => {
    process.env = { ...envSnapshot };
    await openbao.close();
  });

  it("authenticates approle credentials and returns OpenBao headers", async () => {
    const token = await getKibaoToken({
      baseURL: openbao.baseURL,
      namespace: "tenant-a",
      bao: {
        role: { id: "role-id" },
        secret: { id: "secret-id" },
      },
    });

    expect(token).toEqual({
      token: "role-token-from-openbao",
      namespace: "tenant-a",
    });

    expect(openbao.requests[0]).toMatchObject({
      method: "POST",
      path: "/v1/auth/approle/login",
      body: {
        role_id: "role-id",
        secret_id: "secret-id",
      },
    });
    expect(openbao.requests[0]?.headers["x-vault-namespace"]).toBe("tenant-a");
  });

  it("strips public and private token attestations before setting request headers", async () => {
    const publicHeaders = await getKibaoHeaders({
      baseURL: openbao.baseURL,
      location: { path: "/v1/demo/data/test/public" },
      namespace: "public-namespace",
      token: `${PUBLIC_TOKEN_ATTESTATION}public-token`,
    });

    const privateHeaders = await getKibaoHeaders({
      baseURL: openbao.baseURL,
      location: { path: "/v1/demo/data/test/private" },
      token: `${PRIVATE_TOKEN_ATTESTATION}private-token`,
    });

    expect(publicHeaders.headers.get("X-Vault-Token")).toBe("public-token");
    expect(publicHeaders.headers.get("X-Vault-Namespace")).toBe("public-namespace");
    expect(privateHeaders.headers.get("X-Vault-Token")).toBe("private-token");
    expect(privateHeaders.headers.get("X-Vault-Namespace")).toBe("root");
  });

  it("fetches secrets by explicit path", async () => {
    const result = await getSecrets(
      {
        baseURL: openbao.baseURL,
        location: { path: "/v1/custom/public" },
        token: `${PUBLIC_TOKEN_ATTESTATION}path-token`,
      },
      "public",
    );

    expect(result).toEqual({
      access: "public",
      vars: {
        CUSTOM_PUBLIC_FROM_BAO: "custom-public-value",
      },
    });
    expect(openbao.requests[0]?.headers["x-vault-token"]).toBe("path-token");
  });

  it("fetches secrets by app/environment/access location", async () => {
    const result = await getSecrets(
      {
        baseURL: openbao.baseURL,
        location: {
          app: "demo",
          environment: "test",
        },
        token: `${PUBLIC_TOKEN_ATTESTATION}app-token`,
      },
      "public",
    );

    expect(result.vars.PUBLIC_FROM_BAO).toBe("public-value");
    expect(openbao.requests[0]?.path).toBe("/v1/demo/data/test/public");
  });

  it("fills an incomplete location from environment variables", async () => {
    process.env.NUXT_KIBAO_OPENBAO_PUBLIC_LOCATION_APP = "demo";
    process.env.NUXT_KIBAO_OPENBAO_PUBLIC_LOCATION_ENVIRONMENT = "test";

    const result = await getSecrets(
      {
        baseURL: openbao.baseURL,
        location: {} as any,
        token: `${PUBLIC_TOKEN_ATTESTATION}env-location-token`,
      },
      "public",
    );

    expect(result.vars.PUBLIC_FROM_BAO).toBe("public-value");
    expect(openbao.requests[0]?.path).toBe("/v1/demo/data/test/public");
  });

  it("uses access-specific path environment variables", async () => {
    process.env.NUXT_KIBAO_OPENBAO_PRIVATE_LOCATION_PATH = "/v1/demo/data/test/private";

    const result = await getSecrets(
      {
        baseURL: openbao.baseURL,
        location: {} as any,
        token: `${PRIVATE_TOKEN_ATTESTATION}private-path-token`,
      },
      "private",
    );

    expect(result.vars.PRIVATE_FROM_BAO).toBe("private-value");
    expect(openbao.requests[0]?.path).toBe("/v1/demo/data/test/private");
  });

  it("loads all configured public and private variables", async () => {
    const vars = await getAllVars({
      public: {
        baseURL: openbao.baseURL,
        location: {
          app: "demo",
          environment: "test",
        },
        token: `${PUBLIC_TOKEN_ATTESTATION}public-token`,
      },
      private: {
        baseURL: openbao.baseURL,
        location: {
          app: "demo",
          environment: "test",
        },
        bao: {
          role: { id: "role-id" },
          secret: { id: "secret-id" },
        },
      },
    });

    expect(vars).toEqual({
      public: {
        PUBLIC_FROM_BAO: "public-value",
        SHARED_FROM_BAO: "public-shared",
        NUXT_PUBLIC_OBSERVER_VALUE: "observer-public-value",
      },
      private: {
        PRIVATE_FROM_BAO: "private-value",
        SHARED_FROM_BAO: "private-shared",
        NUXT_OBSERVER_SECRET: "observer-private-secret",
      },
    });
  });

  it("loads variables without mutating frozen runtime config credentials", async () => {
    const publicConfig = Object.freeze({
      baseURL: openbao.baseURL,
      location: Object.freeze({
        app: "demo",
        environment: "test",
      }),
      token: `${PUBLIC_TOKEN_ATTESTATION}public-token`,
    });

    const vars = await getAllVars({
      public: publicConfig,
    });

    expect(vars.public).toMatchObject({
      PUBLIC_FROM_BAO: "public-value",
    });
    expect(publicConfig.baseURL).toBe(openbao.baseURL);
  });
});

describe("Kibao environment helpers", () => {
  const envSnapshot = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...envSnapshot };
    delete env.TEST_SET_ENV;
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
    delete env.TEST_SET_ENV;
  });

  it("reads the server URL from supported environment variables", () => {
    process.env.NUXT_KIBAO_SERVER_BAO = " http://openbao.local ";
    expect(getEnvSereverURL()).toBe("http://openbao.local");
  });

  it("crawls Nuxt-prefixed Kibao variables from process.env", () => {
    process.env.NUXT_KIBAO_SERVER_BAO = "http://openbao.local";
    process.env.NUXT_KIBAO_OPENBAO_PUBLIC_TOKEN = `${PUBLIC_TOKEN_ATTESTATION}env-token`;

    expect(crawlVarsFromEnv()).toMatchObject({
      NUXT_KIBAO_SERVER_BAO: "http://openbao.local",
      NUXT_KIBAO_OPENBAO_PUBLIC_TOKEN: `${PUBLIC_TOKEN_ATTESTATION}env-token`,
    });
  });

  it("normalizes Kibao and OpenBao environment aliases to Nuxt runtime keys", () => {
    process.env.KIBAO_SERVER_BAO = "http://openbao.local";
    process.env.OPENBAO_PUBLIC_TOKEN = `${PUBLIC_TOKEN_ATTESTATION}alias-token`;

    expect(crawlVarsFromEnv()).toMatchObject({
      NUXT_KIBAO_SERVER_BAO: "http://openbao.local",
      NUXT_KIBAO_OPENBAO_PUBLIC_TOKEN: `${PUBLIC_TOKEN_ATTESTATION}alias-token`,
    });
  });

  it("reconciles module options, runtime config, and public runtime config", () => {
    const config = reconsileConfig(
      {
        server: {
          bao: "http://option-openbao.local",
          base: "http://option-app.local",
        },
        openbao: {
          public: {
            baseURL: "http://option-openbao.local",
            location: { path: "/v1/options/public" },
            token: `${PUBLIC_TOKEN_ATTESTATION}option-token`,
          },
        },
      },
      {
        public: {
          kibao: {
            vars: {
              FROM_PUBLIC_CONFIG: "yes",
            },
          },
        },
      } as any,
    );

    expect(config).toMatchObject({
      server: {
        bao: "http://option-openbao.local",
      },
      vars: {
        FROM_PUBLIC_CONFIG: "yes",
      },
      openbao: {
        public: {
          token: `${PUBLIC_TOKEN_ATTESTATION}option-token`,
        },
      },
    });
  });

  it("fills module option locations from env without overwriting explicit options", () => {
    process.env.NUXT_KIBAO_SERVER_BAO = "http://env-openbao.local";
    process.env.NUXT_KIBAO_OPENBAO_PUBLIC_TOKEN = `${PUBLIC_TOKEN_ATTESTATION}env-token`;
    process.env.NUXT_KIBAO_OPENBAO_PUBLIC_LOCATION_ENVIRONMENT = "staging";

    const config = reconsileConfig(
      {
        server: {
          base: "http://option-app.local",
        },
        openbao: {
          public: {
            location: {
              app: "heylomeet",
            } as any,
          },
        } as any,
      },
      null,
    );

    expect(config).toMatchObject({
      server: {
        bao: "http://env-openbao.local",
        base: "http://option-app.local",
      },
      openbao: {
        public: {
          token: `${PUBLIC_TOKEN_ATTESTATION}env-token`,
          location: {
            app: "heylomeet",
            environment: "staging",
          },
        },
      },
    });
  });

  it("fills runtime config locations from env without overwriting explicit runtime config", () => {
    process.env.NUXT_KIBAO_OPENBAO_PRIVATE_BAO_ROLE_ID = "env-role";
    process.env.NUXT_KIBAO_OPENBAO_PRIVATE_BAO_SECRET_ID = "env-secret";
    process.env.NUXT_KIBAO_OPENBAO_PRIVATE_LOCATION_ENVIRONMENT = "production";

    const config = reconsileConfig(null, {
      kibao: {
        server: {
          base: "http://runtime-app.local",
        },
        openbao: {
          private: {
            location: {
              app: "heylomeet",
            },
          },
        },
      },
      public: {},
    } as any);

    expect(config).toMatchObject({
      server: {
        base: "http://runtime-app.local",
      },
      openbao: {
        private: {
          bao: {
            role: { id: "env-role" },
            secret: { id: "env-secret" },
          },
          location: {
            app: "heylomeet",
            environment: "production",
          },
        },
      },
    });
  });

  it("sets resolved variables on std-env", () => {
    setEnv({
      vars: {
        TEST_SET_ENV: "set-by-kibao",
      },
    });

    expect(env.TEST_SET_ENV).toBe("set-by-kibao");
    expect(process.env.TEST_SET_ENV).toBe("set-by-kibao");
  });

  it("applies pulled Nuxt env variables to existing runtime config keys", () => {
    const runtimeConfig = {
      apiSecret: "",
      public: {
        apiBase: "",
        nested: {
          value: "",
        },
      },
    } as any;

    applyRuntimeConfigEnv(
      {
        NUXT_API_SECRET: "private-secret",
        NUXT_PUBLIC_API_BASE: "https://api.example.com",
        NUXT_PUBLIC_NESTED_VALUE: "nested-value",
        NUXT_MISSING_VALUE: "ignored",
      },
      runtimeConfig,
    );

    expect(runtimeConfig).toMatchObject({
      apiSecret: "private-secret",
      public: {
        apiBase: "https://api.example.com",
        nested: {
          value: "nested-value",
        },
      },
    });
    expect(runtimeConfig.missingValue).toBeUndefined();
  });

  it("does not require Nuxt runtime config when applying env variables", () => {
    expect(() => applyRuntimeConfigEnv({ NUXT_API_SECRET: "private-secret" }, null)).not.toThrow();
    expect(() => applyRuntimeConfigEnv({ NUXT_API_SECRET: "private-secret" })).not.toThrow();
  });

  it("ignores read-only runtime config keys without throwing", () => {
    const runtimeConfig = Object.freeze({
      apiSecret: "",
    });

    expect(() => {
      applyRuntimeConfigEnv({ NUXT_API_SECRET: "private-secret" }, runtimeConfig);
    }).not.toThrow();
    expect(runtimeConfig.apiSecret).toBe("");
  });
});
