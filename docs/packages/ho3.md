# Ho3

Ho3 provides H3-inspired route composition for Hono applications that use `@hono/zod-openapi`. It keeps middleware, handlers, and folder-owned controllers declarative while returning a normal, middleware-augmented `OpenAPIHono` application.

```bash
pnpm add @chiballc/utils hono @hono/zod-openapi
```

## Create an application

Declare the application's base environment once, then define middleware and controllers without repeating type arguments:

```ts
import {
  createHo3App,
  defineController,
  defineMiddleware,
} from "@chiballc/utils/ho3";

interface AppEnv {
  Bindings: { API_TOKEN: string };
  Variables: { requestId: string };
}

declare module "@chiballc/utils/ho3" {
  interface Ho3Env {
    Bindings: AppEnv["Bindings"];
    Variables: AppEnv["Variables"];
  }
}

const requestContext = defineMiddleware(async (context, next) => {
  context.set("requestId", crypto.randomUUID());
  await next();
});

const users = defineController("/users", [requestContext], (defineHandler) => [
  defineHandler({ method: "get", path: "/me" }, (context) => {
    return context.json({ requestId: context.get("requestId") });
  }),
]);

const app = createHo3App({
  base: "/api/v1",
  middleware: [requestContext],
  controllers: [users],
});

export default app;
```

`Ho3Env` supplies the application bindings and variables used by every definition. Route and controller middleware environments are inferred and intersected with it rather than replacing it. Controller middleware is installed before its handlers.

`createHo3App` installs middleware in array order, then installs controllers. The returned app environment is the intersection of the supplied middleware environments.

Composition uses a typed [Hookable](https://github.com/unjs/hookable) lifecycle:

- `build:pre:middleware` runs before global middleware is registered. It intentionally exposes only `Ho3Env`, not middleware-contributed variables.
- `build:post:middleware` runs after global middleware registration and receives the augmented app type.
- `build:post:controllers` runs after controller registration and receives the augmented app type.

Register hooks through the `hooks` option using Hookable's flat or nested syntax. Composition hooks must be synchronous because `createHo3App` returns a fully registered app synchronously. The returned app exposes its typed `hooks` instance for inspection and additional hooks.

```ts
const app = createHo3App({
  middleware: [requestContext],
  controllers: [users],
  hooks: {
    build: {
      post: {
        controllers(app) {
          app.doc("/openapi.json", {
            openapi: "3.0.0",
            info: { title: "Example API", version: "1.0.0" },
          });
        },
      },
    },
  },
});
```

## OpenAPI handlers

When a handler has a complete Zod OpenAPI route configuration, including `responses`, Ho3 registers it with `app.openapi`. Routes without `responses`, plus `use` and `all` handlers, use ordinary Hono registration.

```ts
import { z } from "@hono/zod-openapi";
import { defineHandler } from "@chiballc/utils/ho3";

const health = defineHandler(
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

`defineRootController` creates routes outside the base passed to `createHo3App` or `installController`. This is useful for discovery endpoints such as `/.well-known/jwks.json`.

The optional final argument to `defineController` and `defineRootController` handles unsupported methods for exact routes. Ho3 supplies an alphabetically sorted `Allow` value and installs these handlers before `all` wildcards.

## Manual composition

Use `installMiddleware`, `installController`, or `installControllers` when routes must be registered between composition steps. All installers accept an optional `{ base }` configuration and operate on the `OpenAPIHono` returned by `createHo3App`.

Middleware paths are explicit. A middleware without `options.base` is installed at `*`; use a path such as `/admin/*` when it should cover a subtree.
