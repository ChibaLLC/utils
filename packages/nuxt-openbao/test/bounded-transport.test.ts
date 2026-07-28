import { createServer, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  KIBAO_DEFAULT_MAX_RESPONSE_BYTES,
  PUBLIC_TOKEN_ATTESTATION,
  getSecrets,
} from "../src/runtime/utils";

type TestServer = {
  baseURL: string;
  close: () => Promise<void>;
};

const servers: TestServer[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

async function server(handler: Parameters<typeof createServer>[0]): Promise<TestServer> {
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

function credentials(baseURL: string) {
  return {
    baseURL,
    location: { path: "/v1/test/data/local/public" },
    token: `${PUBLIC_TOKEN_ATTESTATION}synthetic-public-token`,
  };
}

function sendJson(response: ServerResponse, body: unknown, status = 200) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

describe("bounded Kibao transport", () => {
  it("cancels a chunked response that exceeds the configured limit", async () => {
    let disconnected = false;
    const openbao = await server((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.write('{"data":{"data":{"VALUE":"');
      const interval = setInterval(() => response.write("x".repeat(8 * 1024)), 1);
      response.on("close", () => {
        disconnected = true;
        clearInterval(interval);
      });
    });

    await expect(getSecrets(credentials(openbao.baseURL))).rejects.toThrow("response exceeds");
    await expect.poll(() => disconnected).toBe(true);
  });

  it("rejects declared oversized responses before parsing them", async () => {
    let disconnected = false;
    const openbao = await server((_request, response) => {
      response.writeHead(200, {
        "content-length": String(KIBAO_DEFAULT_MAX_RESPONSE_BYTES + 1),
        "content-type": "application/json",
      });
      response.write("{");
      response.on("close", () => {
        disconnected = true;
      });
    });

    await expect(getSecrets(credentials(openbao.baseURL))).rejects.toThrow("response exceeds");
    await expect.poll(() => disconnected).toBe(true);
  });

  it("propagates cancellation through AppRole login without issuing a secret read", async () => {
    let requests = 0;
    const openbao = await server((request, response) => {
      requests += 1;
      if (request.url === "/v1/auth/approle/login") {
        response.on("close", () => undefined);
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

    await expect.poll(() => requests).toBe(1);
    controller.abort();

    await expect(pending).rejects.toThrow("request was aborted");
    expect(requests).toBe(1);
  });

  it("does not retry failed requests and keeps transport errors value-free", async () => {
    let requests = 0;
    const openbao = await server((_request, response) => {
      requests += 1;
      sendJson(response, { errors: ["synthetic-private-canary"] }, 503);
    });

    const error = await getSecrets(credentials(openbao.baseURL)).catch((value: unknown) => value as Error);

    expect(requests).toBe(1);
    expect(error.message).toBe("The Kibao request failed.");
    expect(error.message).not.toContain("canary");
    expect(error.message).not.toContain("token");
  });

  it("rejects malformed JSON with a stable error", async () => {
    const openbao = await server((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end("not-json");
    });

    await expect(getSecrets(credentials(openbao.baseURL))).rejects.toThrow("response is invalid");
  });
});
