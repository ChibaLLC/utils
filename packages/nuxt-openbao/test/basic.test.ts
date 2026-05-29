import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { setup, $fetch } from "@nuxt/test-utils/e2e";
import { createMockOpenBaoServer } from "./helpers/openbao";

const openbao = await createMockOpenBaoServer();
process.env.MOCK_OPENBAO_URL = openbao.baseURL;
process.env.NUXT_PUBLIC_SITE_URL = "";

afterAll(async () => {
  delete process.env.MOCK_OPENBAO_URL;
  delete process.env.NUXT_PUBLIC_SITE_URL;
  await openbao.close();
});

describe("kibao nuxt runtime", async () => {
  await setup({
    rootDir: fileURLToPath(new URL("./fixtures/basic", import.meta.url)),
    build: true,
    dev: false,
    setupTimeout: 180_000,
  });

  it("exposes public OpenBao variables in the Nuxt runtime", async () => {
    const payload = await $fetch<{
      vars: Record<string, string>;
      processEnv: Record<string, string>;
      runtimeConfig: {
        observerSecret: string;
        public: {
          observerValue: string;
          observerModule: Record<string, string>;
        };
      };
    }>("/api/vars");

    expect(payload.processEnv).toMatchObject({
      PUBLIC_FROM_BAO: "public-value",
      SHARED_FROM_BAO: "private-shared",
    });
    expect(payload.runtimeConfig.public.observerValue).toBe("observer-public-value");
  });

  it("exposes private OpenBao variables on Nitro event context and process.env", async () => {
    const payload = await $fetch<{
      vars: Record<string, string>;
      processEnv: Record<string, string>;
    }>("/api/vars");

    expect(payload.vars).toMatchObject({
      PRIVATE_FROM_BAO: "private-value",
      SHARED_FROM_BAO: "private-shared",
    });
    expect(payload.processEnv).toMatchObject({
      PRIVATE_FROM_BAO: "private-value",
      PUBLIC_FROM_BAO: "public-value",
    });
  });

  it("authenticates role credentials and fetches public and private KV paths", () => {
    expect(openbao.requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: "GET",
          path: "/v1/demo/data/test/public",
        }),
        expect.objectContaining({
          method: "POST",
          path: "/v1/auth/approle/login",
          body: {
            role_id: "fixture-role-id",
            secret_id: "fixture-secret-id",
          },
        }),
        expect.objectContaining({
          method: "GET",
          path: "/v1/demo/data/test/private",
        }),
      ]),
    );
  });

  it("makes OpenBao variables available to later Nuxt modules during build-time setup", async () => {
    const payload = await $fetch<{
      runtimeConfig: {
        observerSecret: string;
        public: {
          observerValue: string;
          observerModule: Record<string, string>;
        };
      };
      processEnv: Record<string, string>;
    }>("/api/vars");

    expect(payload.processEnv).toMatchObject({
      NUXT_PUBLIC_OBSERVER_VALUE: "observer-public-value",
      NUXT_OBSERVER_SECRET: "observer-private-secret",
    });
    expect(payload.runtimeConfig).toMatchObject({
      observerSecret: "observer-private-secret",
      public: {
        observerValue: "observer-public-value",
        observerModule: {
          processPublic: "observer-public-value",
          processPrivate: "observer-private-secret",
          runtimePublic: "observer-public-value",
          runtimePrivate: "observer-private-secret",
        },
      },
    });
  });

  it("makes OpenBao variables available to later Nitro plugins at runtime", async () => {
    const payload = await $fetch<{
      observerRuntime: {
        startup: Record<string, string>;
        request: Record<string, string>;
      };
    }>("/api/vars");

    expect(payload.observerRuntime.startup).toMatchObject({
      processPublic: "observer-public-value",
      processPrivate: "observer-private-secret",
      runtimePublic: "observer-public-value",
      runtimePrivate: "observer-private-secret",
    });
    expect(payload.observerRuntime.request).toMatchObject({
      processPublic: "observer-public-value",
      processPrivate: "observer-private-secret",
      runtimePublic: "observer-public-value",
      runtimePrivate: "observer-private-secret",
    });
    expect(payload.observerRuntime.request.processGoogleCredentials).toBeTypeOf("string");
    expect(JSON.parse(payload.observerRuntime.request.processGoogleCredentials!)).toMatchObject({
      project_id: "observer-project",
    });
  });

  it("refreshes OpenBao variables in a running production server when secrets change", async () => {
    openbao.setSecrets({
      public: {
        PUBLIC_FROM_BAO: "public-value-updated",
        SHARED_FROM_BAO: "public-shared-updated",
        NUXT_PUBLIC_OBSERVER_VALUE: "observer-public-value-updated",
      },
      private: {
        PRIVATE_FROM_BAO: "private-value-updated",
        SHARED_FROM_BAO: "private-shared-updated",
        NUXT_OBSERVER_SECRET: "observer-private-secret-updated",
      },
    });

    const payload = await $fetch<{
      vars: Record<string, string>;
      runtimeConfig: {
        observerSecret: string;
        public: {
          observerValue: string;
        };
      };
      observerRuntime: {
        startup: Record<string, string>;
        request: Record<string, string>;
      };
      processEnv: Record<string, string>;
    }>("/api/vars");

    expect(payload.vars).toMatchObject({
      PUBLIC_FROM_BAO: "public-value",
      PRIVATE_FROM_BAO: "private-value",
      SHARED_FROM_BAO: "private-shared",
    });
    expect(payload.processEnv).toMatchObject({
      PUBLIC_FROM_BAO: "public-value",
      PRIVATE_FROM_BAO: "private-value",
      NUXT_PUBLIC_OBSERVER_VALUE: "observer-public-value",
      NUXT_OBSERVER_SECRET: "observer-private-secret",
    });
    expect(payload.runtimeConfig).toMatchObject({
      observerSecret: "observer-private-secret",
      public: {
        observerValue: "observer-public-value",
      },
    });
    expect(payload.observerRuntime.startup).toMatchObject({
      runtimePublic: "observer-public-value",
      runtimePrivate: "observer-private-secret",
    });
    const observerPayload = await $fetch<{
      vars: Record<string, string>;
      processEnv: Record<string, string>;
      runtimeConfig: {
        observerSecret: string;
        public: {
          observerValue: string;
        };
      };
    }>("/api/observer-refresh");

    expect(observerPayload.vars).toMatchObject({
      PUBLIC_FROM_BAO: "public-value-updated",
      PRIVATE_FROM_BAO: "private-value-updated",
    });
    expect(observerPayload.processEnv).toMatchObject({
      PUBLIC_FROM_BAO: "public-value-updated",
      PRIVATE_FROM_BAO: "private-value-updated",
      NUXT_PUBLIC_OBSERVER_VALUE: "observer-public-value-updated",
      NUXT_OBSERVER_SECRET: "observer-private-secret-updated",
    });
    expect(observerPayload.processEnv.GOOGLE_APPLICATION_CREDENTIALS).toBeTypeOf("string");
    expect(JSON.parse(observerPayload.processEnv.GOOGLE_APPLICATION_CREDENTIALS!)).toMatchObject({
      project_id: "observer-project",
    });
    expect(observerPayload.runtimeConfig).toMatchObject({
      observerSecret: "observer-private-secret-updated",
      public: {
        observerValue: "observer-public-value-updated",
      },
    });
  });
});
