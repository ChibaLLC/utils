import { describe, expect, expectTypeOf, it } from "vitest";
import type { MiddlewareHandler } from "hono";
import { z } from "@hono/zod-openapi";

import {
  createHo3App,
  defineController,
  defineHandler,
  defineMiddleware,
  defineRootController,
  installController,
  type Handler,
  type HandlerCallback,
} from "../src";

interface TestEnv {
  Variables: {
    requestId: string;
  };
}

declare module "../src" {
  interface Ho3Env {
    Bindings: { BASE_URL: string };
  }
}

describe("ho3", () => {
  it("uses an augmented Ho3Env without call-site type arguments", () => {
    defineMiddleware(async (context, next) => {
      expectTypeOf(context.env.BASE_URL).toEqualTypeOf<string>();
      await next();
    });

    defineHandler({ method: "get", path: "/" }, (context) => {
      expectTypeOf(context.env.BASE_URL).toEqualTypeOf<string>();
      return context.text("ok");
    });

    const serveHealth: Handler = (context) => context.text(context.env.BASE_URL);
    const options = { method: "get", path: "/health" } as const;
    const serveTypedHealth: HandlerCallback<import("../src").Ho3Env, typeof options> = (context) =>
      context.text(context.env.BASE_URL);

    expectTypeOf(serveHealth).toBeFunction();
    expectTypeOf(serveTypedHealth).toBeFunction();
  });

  it("composes middleware and controllers under an application base", async () => {
    const middleware = defineMiddleware<TestEnv>(async (context, next) => {
      context.set("requestId", "req-1");
      await next();
    });
    const controller = defineController<TestEnv, [typeof middleware]>("/users", [middleware], (handler) => [
      handler({ method: "get", path: "/me" }, (context) => {
        expectTypeOf(context.get("requestId")).toEqualTypeOf<string>();
        return context.text(context.get("requestId"));
      }),
    ]);
    const app = createHo3App({ base: "/api", middleware: [middleware], controllers: [controller] });

    expectTypeOf(app).toMatchTypeOf<import("@hono/zod-openapi").OpenAPIHono<TestEnv>>();

    const response = await app.request("/api/users/me");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("req-1");
  });

  it("nests relative controllers with inherited middleware environments and routing order", async () => {
    type ActorEnv = { Variables: { actor: string } };
    type TenantEnv = { Variables: { tenant: string } };
    const actor = defineMiddleware<ActorEnv>(async (context, next) => {
      context.set("actor", "Ada");
      await next();
    });
    const tenant = defineMiddleware<TenantEnv>(async (context, next) => {
      context.set("tenant", "chiba");
      await next();
    });
    const auth = defineController<TestEnv, [typeof actor]>(
      "/auth",
      [actor],
      (handler, controller) => [
        handler({ method: "all", path: "/*" }, (context) => context.text("auth fallback")),
        controller(
          "/sessions",
          [tenant],
          (childHandler) => [
            childHandler(
              {
                method: "get",
                path: "/{id}",
                request: { params: z.object({ id: z.string() }) },
                responses: { 200: { description: "Session", content: { "text/plain": { schema: z.string() } } } },
              },
              (context) => {
                expectTypeOf(context.get("actor")).toEqualTypeOf<string>();
                expectTypeOf(context.get("tenant")).toEqualTypeOf<string>();
                return context.text(
                  `${context.get("actor")}:${context.get("tenant")}:${context.req.valid("param").id}`,
                  200,
                );
              },
            ),
          ],
          (_context, allow) => new Response("nested unsupported", { status: 405, headers: { Allow: allow } }),
        ),
      ],
    );
    const app = createHo3App({ base: "/api/v1", controllers: [auth] });

    expect(await (await app.request("/api/v1/auth/sessions/session-1")).text()).toBe("Ada:chiba:session-1");
    const unsupported = await app.request("/api/v1/auth/sessions/session-1", { method: "PUT" });
    expect(unsupported.status).toBe(405);
    expect(unsupported.headers.get("Allow")).toBe("GET, HEAD");
    expect(await (await app.request("/api/v1/auth/unknown")).text()).toBe("auth fallback");
  });

  it("defers nested wildcards until later sibling concrete routes are installed", async () => {
    const parent = defineController("/parent", [], (_handler, controller) => {
      const fallback = controller("/child", [], (handler) => [
        handler({ method: "all", path: "/*" }, (context) => context.text("child fallback")),
      ]);
      const wrappedFallback: typeof fallback = (app, config) => fallback(app, config);
      return [
        wrappedFallback,
        controller("/child", [], (handler) => [
          handler({ method: "get", path: "/exact" }, (context) => context.text("exact")),
        ]),
      ];
    });
    const app = createHo3App();
    parent(app, { base: "" });

    expect(await (await app.request("/parent/child/exact")).text()).toBe("exact");
    expect(await (await app.request("/parent/child/unknown")).text()).toBe("child fallback");
  });

  it("defers nested method fallbacks and combines sibling Allow methods", async () => {
    const parent = defineController<TestEnv, []>("/parent", [], (_handler, controller) => [
      controller(
        "/child",
        [],
        (handler) => [handler({ method: "get", path: "/exact/{id}" }, (context) => context.text("get"))],
        (_context, allow) => new Response("unsupported", { status: 405, headers: { Allow: allow } }),
      ),
      controller("/child", [], (handler) => [
        handler({ method: "post", path: "/exact/{slug}" }, (context) => context.text("post")),
      ]),
    ]);
    const app = createHo3App({ controllers: [parent] });

    expect(await (await app.request("/parent/child/exact/value", { method: "POST" })).text()).toBe("post");
    const unsupported = await app.request("/parent/child/exact/value", { method: "PUT" });
    expect(unsupported.status).toBe(405);
    expect(unsupported.headers.get("Allow")).toBe("GET, HEAD, POST");
  });

  it("keeps literal colon segments distinct when combining Allow methods", async () => {
    const controller = defineController<TestEnv, []>(
      "/items",
      [],
      (handler) => [
        handler({ method: "get", path: "/literal:foo" }, (context) => context.text("get")),
        handler({ method: "post", path: "/literal:bar" }, (context) => context.text("post")),
      ],
      (_context, allow) => new Response("unsupported", { status: 405, headers: { Allow: allow } }),
    );
    const app = createHo3App({ controllers: [controller] });

    const unsupported = await app.request("/items/literal:foo", { method: "PUT" });
    expect(unsupported.headers.get("Allow")).toBe("GET, HEAD");
  });

  it("installs root controllers outside the application base", async () => {
    const root = defineRootController<TestEnv, []>([], (handler) => [
      handler({ method: "get", path: "/.well-known/keys" }, (context) => context.text("root")),
    ]);
    const parent = defineController<TestEnv, []>("/parent", [], () => [root]);
    const app = createHo3App();
    installController(app, parent, { base: "/api" });

    expect((await app.request("/.well-known/keys")).status).toBe(200);
    expect((await app.request("/api/parent/.well-known/keys")).status).toBe(404);
  });

  it("handles unsupported methods before controller wildcards", async () => {
    const get = defineHandler<TestEnv>({ method: "get", path: "/token" }, (context) => context.text("get"));
    const post = defineHandler<TestEnv>({ method: "post", path: "/token" }, (context) => context.text("post"));
    const fallback = defineHandler<TestEnv>({ method: "all", path: "/*" }, (context) => context.text("fallback"));
    const controller = defineController<TestEnv, []>(
      "/auth",
      [],
      () => [post, fallback, get],
      (_context, allow) => new Response("unsupported", { status: 405, headers: { Allow: allow } }),
    );
    const app = createHo3App({ controllers: [controller] });

    const unsupported = await app.request("/auth/token", { method: "PUT" });
    const unknown = await app.request("/auth/unknown");

    expect(unsupported.status).toBe(405);
    expect(unsupported.headers.get("Allow")).toBe("GET, HEAD, POST");
    expect(await unknown.text()).toBe("fallback");
  });

  it("matches OpenAPI parameter paths for generated method handlers", async () => {
    const controller = defineController<TestEnv, []>(
      "/items",
      [],
      (handler) => [
        handler(
          {
            method: "get",
            path: "/{id}",
            request: { params: z.object({ id: z.string() }) },
            responses: {
              200: {
                description: "Item",
                content: { "text/plain": { schema: z.string() } },
              },
            },
          },
          (context) => context.text(context.req.valid("param").id),
        ),
      ],
      (_context, allow) => new Response(null, { status: 405, headers: { Allow: allow } }),
    );
    const app = createHo3App({ controllers: [controller] });

    expect(await (await app.request("/items/item-1")).text()).toBe("item-1");

    const unsupported = await app.request("/items/item-1", { method: "PUT" });
    expect(unsupported.status).toBe(405);
    expect(unsupported.headers.get("Allow")).toBe("GET, HEAD");
  });

  it("adds route middleware environments to standalone handlers", () => {
    type AddedEnv = { Variables: { actor: string } };
    const middleware = (() => undefined) as unknown as MiddlewareHandler<AddedEnv>;
    const options = { method: "get", path: "/", middleware } as const;

    defineHandler<TestEnv, typeof options>(options, (context) => {
      expectTypeOf(context.get("requestId")).toEqualTypeOf<string>();
      expectTypeOf(context.get("actor")).toEqualTypeOf<string>();
      return context.text("ok");
    });
  });

  it("intersects app environments from ordered middleware", () => {
    type BindingsEnv = { Bindings: { TOKEN: string } };
    type VariablesEnv = { Variables: { actor: string } };
    const bindings = defineMiddleware<BindingsEnv>(async (_context, next) => next());
    const variables = defineMiddleware<VariablesEnv>(async (context, next) => {
      context.set("actor", "Ada");
      await next();
    });

    const app = createHo3App({
      middleware: [bindings, variables],
      hooks: {
        build: {
          post: {
            controllers(composedApp) {
              composedApp.get("/typed", (context) => {
                expectTypeOf(context.env.TOKEN).toEqualTypeOf<string>();
                expectTypeOf(context.get("actor")).toEqualTypeOf<string>();
                return context.text("ok");
              });
            },
          },
        },
      },
    });

    expectTypeOf(app).toMatchTypeOf<import("@hono/zod-openapi").OpenAPIHono<BindingsEnv & VariablesEnv>>();
  });

  it("runs typed composition hooks in lifecycle order", () => {
    const calls: string[] = [];
    const app = createHo3App({
      hooks: {
        build: {
          pre: {
            middleware: () => calls.push("pre:middleware"),
          },
          post: {
            middleware: () => calls.push("post:middleware"),
            controllers: () => calls.push("post:controllers"),
          },
        },
      },
    });

    expect(calls).toEqual(["pre:middleware", "post:middleware", "post:controllers"]);
    expect(app.hooks).toBeDefined();
  });

  it("rejects asynchronous composition hooks", () => {
    expect(() =>
      createHo3App({
        hooks: {
          build: {
            pre: {
              middleware: async () => undefined,
            },
          },
        },
      }),
    ).toThrow("Ho3 composition hook build:pre:middleware must be synchronous");
  });
});
