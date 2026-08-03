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
} from "../src";

interface TestEnv {
  Variables: {
    requestId: string;
  };
}

describe("ho3", () => {
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

  it("installs root controllers outside the application base", async () => {
    const root = defineRootController<TestEnv, []>([], (handler) => [
      handler({ method: "get", path: "/.well-known/keys" }, (context) => context.text("root")),
    ]);
    const app = createHo3App();
    installController(app, root, { base: "/api" });

    expect((await app.request("/.well-known/keys")).status).toBe(200);
    expect((await app.request("/api/.well-known/keys")).status).toBe(404);
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
      afterControllers(composedApp) {
        composedApp.get("/typed", (context) => {
          expectTypeOf(context.env.TOKEN).toEqualTypeOf<string>();
          expectTypeOf(context.get("actor")).toEqualTypeOf<string>();
          return context.text("ok");
        });
      },
    });

    expectTypeOf(app).toMatchTypeOf<import("@hono/zod-openapi").OpenAPIHono<BindingsEnv & VariablesEnv>>();
  });
});
