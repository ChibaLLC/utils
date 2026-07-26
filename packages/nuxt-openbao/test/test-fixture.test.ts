import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { $fetch, fetch, setup } from "@nuxt/test-utils/e2e";
import { assertTestFixtureAllowed } from "../src/runtime/test";

const originalNuxtTest = process.env.NUXT_TEST;
process.env.NUXT_TEST = "true";

afterAll(() => {
  if (originalNuxtTest === undefined) {
    delete process.env.NUXT_TEST;
  } else {
    process.env.NUXT_TEST = originalNuxtTest;
  }

});

describe("Kibao test fixture", async () => {
  await setup({
    build: true,
    dev: false,
    rootDir: fileURLToPath(new URL("./fixtures/test-mode", import.meta.url)),
  });

  it("injects synthetic values without an OpenBao server", async () => {
    const payload = await $fetch<{
      processEnv: Record<string, string>;
      runtimeConfig: {
        observerSecret: string;
        public: { observerValue: string; kibao: { test: { vars: Record<string, string> } } };
      };
    }>("/api/observer-runtime");

    expect(payload.processEnv).toMatchObject({
      PRIVATE_FROM_BAO: "test-private-value",
      PUBLIC_FROM_BAO: "test-public-value",
    });
    expect(payload.runtimeConfig).toMatchObject({
      observerSecret: "test-observer-private-value",
      public: { observerValue: "test-observer-public-value" },
    });
    expect(payload.runtimeConfig.public.kibao.test.vars).toEqual({});
    expect(JSON.stringify(payload.runtimeConfig.public.kibao)).not.toContain("test-private-value");
  });

  it("rejects fixtures outside the test harness", () => {
    process.env.NUXT_TEST = "false";

    expect(() => assertTestFixtureAllowed({ vars: { public: { VALUE: "synthetic" } } })).toThrow(
      "KIBAO TEST FIXTURE REJECTED",
    );

    process.env.NUXT_TEST = "true";
  });

  it("does not register an OpenBao proxy route", async () => {
    const response = await fetch("/bao-proxy/v1/drive/data/local/public");

    expect(response.status).toBe(404);
  });
});
