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
import {
  crawlVarsFromEnv,
  getEnvSereverURL,
  reconsileConfig,
  setEnv,
} from "../src/runtime/env";
import { createMockOpenBaoServer, type MockOpenBaoServer } from "./helpers/openbao";

describe("OpenBao runtime helpers", () => {
  let openbao: MockOpenBaoServer;

  beforeEach(async () => {
    openbao = await createMockOpenBaoServer();
  });

  afterEach(async () => {
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
      },
      private: {
        PRIVATE_FROM_BAO: "private-value",
        SHARED_FROM_BAO: "private-shared",
      },
    });
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
    process.env.NUXT_KIBAO_BAO_SERVER_URL = " http://openbao.local ";
    expect(getEnvSereverURL()).toBe("http://openbao.local");
  });

  it("crawls Nuxt-prefixed Kibao variables from process.env", () => {
    process.env.NUXT_KIBAO_BAO_SERVER_URL = "http://openbao.local";
    process.env.NUXT_KIBAO_OPENBAO_PUBLIC_TOKEN = `${PUBLIC_TOKEN_ATTESTATION}env-token`;

    expect(crawlVarsFromEnv()).toMatchObject({
      NUXT_KIBAO_BAO_SERVER_URL: "http://openbao.local",
      NUXT_KIBAO_OPENBAO_PUBLIC_TOKEN: `${PUBLIC_TOKEN_ATTESTATION}env-token`,
    });
  });

  it("reconciles module options, runtime config, and public runtime config", () => {
    const config = reconsileConfig(
      {
        baseURL: "http://option-openbao.local",
        serverURL: "http://option-app.local",
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
      baoServerURL: "http://option-openbao.local",
      serverURL: "http://option-app.local",
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

  it("sets resolved variables on std-env", () => {
    setEnv({
      vars: {
        TEST_SET_ENV: "set-by-kibao",
      },
    });

    expect(env.TEST_SET_ENV).toBe("set-by-kibao");
    expect(process.env.TEST_SET_ENV).toBe("set-by-kibao");
  });
});
