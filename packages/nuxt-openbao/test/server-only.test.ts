import { execFile } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMockOpenBaoServer, type MockOpenBaoServer } from "./helpers/openbao";

const execFileAsync = promisify(execFile);
const fixtureRoot = fileURLToPath(new URL("./fixtures/server-only", import.meta.url));

describe("Kibao server-only mode", () => {
  let openbao: MockOpenBaoServer;
  let worker: { fetch(request: Request): Promise<Response> };

  beforeAll(async () => {
    openbao = await createMockOpenBaoServer();
    rmSync(`${fixtureRoot}/.output`, { force: true, recursive: true });
    rmSync(`${fixtureRoot}/.nuxt`, { force: true, recursive: true });
    await execFileAsync("pnpm", ["exec", "nuxi", "build", fixtureRoot, "--preset=cloudflare_module"], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: { ...process.env, MOCK_OPENBAO_URL: openbao.baseURL },
      timeout: 240_000,
    });
    Object.defineProperty(globalThis, "WebSocketPair", { configurable: true, value: Object });
    const outputURL = pathToFileURL(`${fixtureRoot}/.output/server/index.mjs`);
    outputURL.searchParams.set("t", String(Date.now()));
    worker = (await import(outputURL.href)).default;
  }, 300_000);

  afterAll(async () => {
    await openbao?.close();
  });

  it("omits the OpenBao proxy route", async () => {
    const response = await worker.fetch(new Request("https://fixture.test/bao-proxy/v1/demo/data/test/public"), {
      ASSETS: { fetch: () => new Response(null, { status: 404 }) },
    });

    expect(response.status).toBe(404);
  });
});
