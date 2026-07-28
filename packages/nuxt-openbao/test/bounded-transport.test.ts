import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  KIBAO_DEFAULT_MAX_RESPONSE_BYTES,
  PUBLIC_TOKEN_ATTESTATION,
  getSecrets,
} from "../src/runtime/utils";
import { sendJson } from "./helpers/openbao";

type TestServer = {
  baseURL: string;
  close: () => Promise<void>;
};

const servers: TestServer[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

async function createTestServer(handler: Parameters<typeof createServer>[0]): Promise<TestServer> {
  const instance = createServer(handler);
  await new Promise<void>((resolve) => instance.listen(0, "127.0.0.1", resolve));
  const address = instance.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to TCP.");

  const result = {
    baseURL: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        instance.close((error) => (error ? reject(error) : resolve()));
      }),
  };
  servers.push(result);
  return result;
}

function createTokenCredentials(baseURL: string) {
  return {
    baseURL,
    location: { path: "/v1/test/data/local/public" },
    token: `${PUBLIC_TOKEN_ATTESTATION}synthetic-public-token`,
  };
}

describe("bounded Kibao transport", () => {
  it("cancels a chunked response that exceeds the configured limit", async () => {
    let disconnected = false;
    const openbao = await createTestServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.write('{"data":{"data":{"VALUE":"');
      const interval = setInterval(() => response.write("x".repeat(8 * 1024)), 1);
      response.on("close", () => {
        disconnected = true;
        clearInterval(interval);
      });
    });

    await expect(getSecrets(createTokenCredentials(openbao.baseURL))).rejects.toThrow("response exceeds");
    await expect.poll(() => disconnected).toBe(true);
  });

  it("rejects declared oversized responses before parsing them", async () => {
    let disconnected = false;
    const openbao = await createTestServer((_request, response) => {
      response.writeHead(200, {
        "content-length": String(KIBAO_DEFAULT_MAX_RESPONSE_BYTES + 1),
        "content-type": "application/json",
      });
      response.write("{");
      response.on("close", () => {
        disconnected = true;
      });
    });

    await expect(getSecrets(createTokenCredentials(openbao.baseURL))).rejects.toThrow("response exceeds");
    await expect.poll(() => disconnected).toBe(true);
  });

  it("propagates cancellation from AppRole login through the secret read", async () => {
    let requests = 0;
    let secretReadStarted!: () => void;
    const secretReadStartedPromise = new Promise<void>((resolve) => {
      secretReadStarted = resolve;
    });
    let disconnected = false;
    const openbao = await createTestServer((request, response) => {
      requests += 1;
      if (request.url === "/v1/auth/approle/login") {
        sendJson(response, { auth: { client_token: "synthetic-role-token" } });
      } else {
        response.writeHead(200, { "content-type": "application/json" });
        response.write('{"data":{"data":{"VALUE":"');
        response.on("close", () => {
          disconnected = true;
        });
        secretReadStarted();
      }
    });
    const controller = new AbortController();
    const pending = getSecrets(
      {
        baseURL: openbao.baseURL,
        location: { path: "/v1/test/data/local/private" },
        bao: { role: { id: "synthetic-role" }, secret: { id: "synthetic-secret" } },
      },
      "private",
      { signal: controller.signal },
    );

    await secretReadStartedPromise;
    controller.abort();

    await expect(pending).rejects.toThrow("request was aborted");
    expect(requests).toBe(2);
    await expect.poll(() => disconnected).toBe(true);
  });

  it("does not retry failed requests and keeps transport errors value-free", async () => {
    let requests = 0;
    let disconnected = false;
    const openbao = await createTestServer((_request, response) => {
      requests += 1;
      response.writeHead(503, { "content-type": "application/json" });
      response.write('{"errors":["synthetic-private-canary"]}');
      response.on("close", () => {
        disconnected = true;
      });
    });

    const error = await getSecrets(createTokenCredentials(openbao.baseURL)).catch((value: unknown) => value as Error);

    expect(requests).toBe(1);
    expect(error.message).toBe("The Kibao request failed.");
    expect(error.message).not.toContain("canary");
    expect(error.message).not.toContain("token");
    await expect.poll(() => disconnected).toBe(true);
  });

  it("cancels malformed responses with a stable error", async () => {
    let disconnected = false;
    const openbao = await createTestServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/plain" });
      response.write("not-json");
      response.on("close", () => {
        disconnected = true;
      });
    });

    await expect(getSecrets(createTokenCredentials(openbao.baseURL))).rejects.toThrow("response is invalid");
    await expect.poll(() => disconnected).toBe(true);
  });
});
