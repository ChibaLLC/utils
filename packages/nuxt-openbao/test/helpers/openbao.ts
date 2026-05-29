import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Buffer } from "node:buffer";

export type MockOpenBaoRequest = {
  method: string;
  path: string;
  body: unknown;
  headers: IncomingMessage["headers"];
};

export type MockOpenBaoServer = {
  baseURL: string;
  requests: MockOpenBaoRequest[];
  setSecrets: (secrets: Partial<MockOpenBaoSecrets>) => void;
  close: () => Promise<void>;
};

export type MockOpenBaoSecrets = {
  public: Record<string, string>;
  private: Record<string, string>;
  customPublic: Record<string, string>;
};

export async function createMockOpenBaoServer(): Promise<MockOpenBaoServer> {
  const requests: MockOpenBaoRequest[] = [];
  const secrets: MockOpenBaoSecrets = {
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
    customPublic: {
      CUSTOM_PUBLIC_FROM_BAO: "custom-public-value",
    },
  };

  const server = createServer(async (request, response) => {
    const path = request.url || "/";
    const body = await readBody(request);

    requests.push({
      method: request.method || "GET",
      path,
      body,
      headers: request.headers,
    });

    if (request.method === "POST" && path === "/v1/auth/approle/login") {
      return sendJson(response, {
        auth: {
          client_token: "role-token-from-openbao",
        },
      });
    }

    if (request.method === "GET" && path === "/v1/demo/data/test/public") {
      return sendJson(response, {
        data: {
          data: secrets.public,
        },
      });
    }

    if (request.method === "GET" && path === "/v1/demo/data/test/private") {
      return sendJson(response, {
        data: {
          data: secrets.private,
        },
      });
    }

    if (request.method === "GET" && path === "/v1/custom/public") {
      return sendJson(response, {
        data: {
          data: secrets.customPublic,
        },
      });
    }

    return sendJson(response, { errors: [`Unhandled ${request.method} ${path}`] }, 404);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to determine mock OpenBao server address");
  }

  return {
    baseURL: `http://127.0.0.1:${address.port}`,
    requests,
    setSecrets(next) {
      Object.assign(secrets.public, next.public);
      Object.assign(secrets.private, next.private);
      Object.assign(secrets.customPublic, next.customPublic);
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function sendJson(response: ServerResponse, body: unknown, status = 200) {
  response.writeHead(status, {
    "content-type": "application/json",
  });
  response.end(JSON.stringify(body));
}
