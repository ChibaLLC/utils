import { execFile } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMockOpenBaoServer, type MockOpenBaoServer } from "./helpers/openbao";

const execFileAsync = promisify(execFile);
const fixtureRoot = fileURLToPath(new URL("./fixtures/cloudflare", import.meta.url));

type WorkerModule = {
  default: {
    fetch(request: Request, env?: Record<string, unknown>, context?: ExecutionContextLike): Promise<Response>;
  };
};

type ExecutionContextLike = {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
};

describe("kibao cloudflare runtime", () => {
  let openbao: MockOpenBaoServer;
  let worker: WorkerModule["default"];

  beforeAll(async () => {
    openbao = await createMockOpenBaoServer();
    await execFileAsync("pnpm", ["exec", "nuxi", "build", fixtureRoot, "--preset=cloudflare_module"], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: {
        ...process.env,
        MOCK_OPENBAO_URL: openbao.baseURL,
        NUXT_PUBLIC_SITE_URL: "",
      },
      timeout: 240_000,
    });

    const outputURL = pathToFileURL(`${fixtureRoot}/.output/server/index.mjs`);
    outputURL.searchParams.set("t", String(Date.now()));
    worker = (await import(outputURL.href) as WorkerModule).default;
  }, 300_000);

  afterAll(async () => {
    await openbao?.close();
  });

  it("serves OpenBao variables from a built Cloudflare Worker", async () => {
    const payload = await fetchJson("/api/vars");

    expect(payload.vars).toMatchObject({
      PUBLIC_FROM_BAO: "public-value",
      PRIVATE_FROM_BAO: "private-value",
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
  });

  it("refreshes changed OpenBao variables inside the running Cloudflare Worker", async () => {
    openbao.setSecrets({
      public: {
        PUBLIC_FROM_BAO: "cloudflare-public-updated",
        NUXT_PUBLIC_OBSERVER_VALUE: "cloudflare-observer-public-updated",
      },
      private: {
        PRIVATE_FROM_BAO: "cloudflare-private-updated",
        NUXT_OBSERVER_SECRET: "cloudflare-observer-private-updated",
      },
    });

    const payload = await fetchJson("/api/observer-runtime");

    expect(payload.vars).toMatchObject({
      PUBLIC_FROM_BAO: "cloudflare-public-updated",
      PRIVATE_FROM_BAO: "cloudflare-private-updated",
    });
    expect(payload.processEnv).toMatchObject({
      PUBLIC_FROM_BAO: "cloudflare-public-updated",
      PRIVATE_FROM_BAO: "cloudflare-private-updated",
      NUXT_PUBLIC_OBSERVER_VALUE: "cloudflare-observer-public-updated",
      NUXT_OBSERVER_SECRET: "cloudflare-observer-private-updated",
    });
    expect(payload.runtimeConfig).toMatchObject({
      observerSecret: "cloudflare-observer-private-updated",
      public: {
        observerValue: "cloudflare-observer-public-updated",
      },
    });
  });

  async function fetchJson(path: string) {
    const response = await worker.fetch(new Request(`https://fixture.test${path}`), {}, createExecutionContext());
    expect(response.status).toBe(200);
    return response.json() as Promise<any>;
  }
});

function createExecutionContext(): ExecutionContextLike {
  const pending: Promise<unknown>[] = [];
  return {
    waitUntil(promise) {
      pending.push(promise);
    },
    passThroughOnException() {},
  };
}
