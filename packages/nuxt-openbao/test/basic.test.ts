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
    setupTimeout: 180_000,
  });

  it("renders public OpenBao variables through the Nuxt plugin", async () => {
    const html = await $fetch("/");

    expect(html).toContain("Kibao fixture");
    expect(html).toContain("public-value");
    expect(html).toContain("public-shared");
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
});
