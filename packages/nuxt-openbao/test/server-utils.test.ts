import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "std-env";

const mocks = vi.hoisted(() => ({
  applyRuntimeConfigEnv: vi.fn(),
  getAllVars: vi.fn(),
  reconsileConfig: vi.fn(),
  setEnv: vi.fn(),
  useRuntimeConfig: vi.fn(),
}));

vi.mock("nitropack/runtime", () => ({
  useRuntimeConfig: mocks.useRuntimeConfig,
}));

vi.mock("../src/runtime/utils", () => ({
  getAllVars: mocks.getAllVars,
}));

vi.mock("../src/runtime/env", () => ({
  applyRuntimeConfigEnv: mocks.applyRuntimeConfigEnv,
  crawlVarsFromEnv: vi.fn(() => ({})),
  reconsileConfig: mocks.reconsileConfig,
  setEnv: mocks.setEnv,
}));

describe("kibao server env injection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.__KIBAO_INJECTED;
    delete process.env.SECRET_FROM_BAO;
    delete env.__KIBAO_INJECTED;
    delete env.SECRET_FROM_BAO;

    mocks.useRuntimeConfig.mockReturnValue({
      kibao: {},
      public: {},
    });
    mocks.reconsileConfig.mockReturnValue({
      disabled: false,
      openbao: { private: {} },
      server: { bao: "https://bao.example.test" },
    });
    mocks.getAllVars.mockResolvedValue({
      private: {
        SECRET_FROM_BAO: "secret-value",
      },
    });
    mocks.setEnv.mockImplementation(({ vars }: { vars: Record<string, unknown> }) => {
      for (const [key, value] of Object.entries(vars)) {
        const stringValue = typeof value === "string" ? value : JSON.stringify(value);
        process.env[key] = stringValue;
        env[key] = stringValue;
      }
    });
  });

  it("skips request reinjection when startup already marked env as injected", async () => {
    const { injectVars } = await import("../src/runtime/server/utils");
    const request = await createRequestHook(injectVars);

    await request({ context: {} });

    expect(mocks.setEnv).toHaveBeenCalledTimes(1);
    expect(mocks.setEnv).toHaveBeenLastCalledWith({
      vars: {
        SECRET_FROM_BAO: "secret-value",
        __KIBAO_INJECTED: "true",
      },
    });
  });

  it("reinjects cached vars when the injected marker is missing", async () => {
    const { injectVars } = await import("../src/runtime/server/utils");
    const request = await createRequestHook(injectVars);

    await request({ context: {} });
    delete process.env.__KIBAO_INJECTED;

    await request({ context: {} });

    expect(mocks.setEnv).toHaveBeenCalledTimes(2);
    expect(mocks.setEnv).toHaveBeenLastCalledWith({
      vars: {
        SECRET_FROM_BAO: "secret-value",
        __KIBAO_INJECTED: "true",
      },
    });
  });
});

async function createRequestHook(injectVars: (options: { app: any }) => Promise<void>) {
  let request: ((event: { context: Record<string, unknown> }) => Promise<void>) | undefined;
  await injectVars({
    app: {
      hooks: {
        hook(name: string, handler: typeof request) {
          if (name === "request") {
            request = handler;
          }
        },
      },
    },
  });

  if (!request) {
    throw new Error("request hook was not registered");
  }

  return request;
}
