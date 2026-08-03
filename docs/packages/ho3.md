# Ho3

Ho3 provides H3-inspired route composition for Hono applications that use `@hono/zod-openapi`. It keeps middleware, handlers, and folder-owned controllers declarative while returning a normal `OpenAPIHono` application.

```bash
pnpm add @chiballc/utils hono @hono/zod-openapi
```

## Create an application

Define middleware and controllers, then compose them with `createApp`:

```ts
import {
  createApp,
  defineController,
  defineMiddleware,
} from "@chiballc/utils/ho3";

interface AppEnv {
  Bindings: { API_TOKEN: string };
  Variables: { requestId: string };
}

const requestContext = defineMiddleware<AppEnv>(async (context, next) => {
  context.set("requestId", crypto.randomUUID());
  await next();
});

const users = defineController<AppEnv, [typeof requestContext]>(
  "/users",
  [requestContext],
  (defineHandler) => [
    defineHandler({ method: "get", path: "/me" }, (context) => {
      return context.json({ requestId: context.get("requestId") });
    }),
  ],
);

const app = createApp<AppEnv>({
  base: "/api/v1",
  controllers: [users],
});

export default app;
```

Controller middleware is installed before its handlers. Its Hono environment is also added to the contextual type of every handler created by the controller callback.

## OpenAPI handlers

When a handler has a complete Zod OpenAPI route configuration, including `responses`, Ho3 registers it with `app.openapi`. Routes without `responses`, plus `use` and `all` handlers, use ordinary Hono registration.

```ts
import { z } from "@hono/zod-openapi";
import { defineHandler } from "@chiballc/utils/ho3";

const health = defineHandler<AppEnv>(
  {
    method: "get",
    path: "/health",
    responses: {
      200: {
        description: "Service health",
        content: {
          "application/json": {
            schema: z.object({ ok: z.boolean() }),
          },
        },
      },
    },
  },
  (context) => context.json({ ok: true }, 200),
);
```

## Root controllers and 405 responses

`defineRootController` creates routes outside the base passed to `createApp` or `installController`. This is useful for discovery endpoints such as `/.well-known/jwks.json`.

The optional final argument to `defineController` and `defineRootController` handles unsupported methods for exact routes. Ho3 supplies an alphabetically sorted `Allow` value and installs these handlers before `all` wildcards.

## Manual composition

Use `installMiddleware`, `installController`, or `installControllers` when routes must be registered between composition steps. All installers accept an optional `{ base }` configuration and operate on the `OpenAPIHono` returned by `createApp`.

Middleware paths are explicit. A middleware without `options.base` is installed at `*`; use a path such as `/admin/*` when it should cover a subtree.
