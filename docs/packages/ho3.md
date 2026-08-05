# Ho3

Ho3 provides H3-inspired route composition for Hono applications that use `@hono/zod-openapi`. It keeps middleware, handlers, and folder-owned route trees declarative while returning a normal `OpenAPIHono` application.

```bash
pnpm add @chiballc/utils hono @hono/zod-openapi
```

## Mental model

Ho3 has four composition concepts:

| Concept               | Created with       | Responsibility                                                                                                                        |
| --------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Middleware definition | `defineMiddleware` | Adds request behavior and can populate typed context variables. Runtime bindings still come from the platform or request environment. |
| Handler definition    | `defineHandler`    | Defines one leaf route and its callback.                                                                                              |
| Controller            | `defineController` | Owns a relative base, middleware, leaf handlers, child controllers, and fallback policy.                                              |
| Application           | `createHo3App`     | Installs global middleware and controller trees under an optional application base.                                                   |

A controller's `routes` accepts either one handler/controller or a readonly array containing both. Concrete entries retain their relative order; generated 405 handlers and wildcard `all` routes are deliberately deferred as described in [405 responses and fallback ordering](#_405-responses-and-fallback-ordering). Callers do not need to separate leaf handlers from nested controllers. For example, after importing four route definitions:

```ts
import { defineController } from "@chiballc/utils/ho3";
import credentials from "./credentials";
import { session, signIn } from "./handlers";
import betterAuthFallback from "./better-auth-fallback";

const auth = defineController({
  base: "/auth",
  routes: [session, signIn, credentials, betterAuthFallback],
});
```

Paths compose from left to right:

```text
application base  /api/v1
controller base   /auth
child base        /credentials
handler path      /{id}
result            /api/v1/auth/credentials/{id}
```

## Quick start

Declare the application environment once with module augmentation. Every unparameterized Ho3 definition then uses that environment.

```ts
import { createHo3App, defineController, defineHandler, defineMiddleware } from "@chiballc/utils/ho3";

interface AppEnv {
  Bindings: {
    DATABASE_URL: string;
  };
  Variables: {
    requestId: string;
  };
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

const currentUser = defineHandler({ method: "get", path: "/me" }, (context) => {
  return context.json({ requestId: context.get("requestId") });
});

const users = defineController({
  base: "/users",
  routes: currentUser,
});

export default createHo3App({
  base: "/api/v1",
  middleware: [requestContext],
  controllers: [users],
});
```

`Ho3Env` remains part of the application type when global middleware adds more bindings or variables. Middleware environments are intersected with it rather than replacing it.

## Controller interface

The object form is the default interface for reusable route modules:

```ts
import { defineController, defineHandler, defineMiddleware } from "@chiballc/utils/ho3";

const requireSession = defineMiddleware(async (context, next) => {
  if (!context.req.header("authorization")) {
    return context.json({ code: "UNAUTHORIZED" }, 401);
  }
  await next();
});

const listProjects = defineHandler({ method: "get", path: "/" }, (context) => context.json({ projects: [] }));

const createProject = defineHandler({ method: "post", path: "/" }, (context) => context.json({ created: true }, 201));

const projects = defineController({
  base: "/projects",
  middleware: [requireSession],
  routes: [listProjects, createProject],
  methodNotAllowed: (context, allow) => {
    return context.json({ code: "METHOD_NOT_ALLOWED" }, 405, { Allow: allow });
  },
});
```

| Property           | Required | Meaning                                                                                                                              |
| ------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `base`             | Yes      | Relative base joined to the application and ancestor-controller bases.                                                               |
| `routes`           | Yes      | One handler/controller or a readonly array of both. Concrete entries are ordered; generated 405 and wildcard fallbacks are deferred. |
| `middleware`       | No       | Controller-scoped middleware definitions installed before the subtree.                                                               |
| `methodNotAllowed` | No       | Exact-route 405 response factory. Ho3 supplies the aggregated `Allow` value.                                                         |

Use `routes: handler` when a controller owns one leaf. Change it to an array when the module grows without changing the surrounding interface:

```ts
const health = defineHandler({ method: "get", path: "/" }, (context) => {
  return context.json({ ok: true });
});

export default defineController({
  base: "/health",
  routes: health,
});
```

## Recipe: folder-owned route trees

Keep each subtree's base and policy in the module that owns it. Parent modules import controllers directly instead of repeating their paths.

```ts
// controllers/auth/credentials.ts
import { defineController, defineHandler } from "@chiballc/utils/ho3";
import requireSession from "../../middleware/require-session";

const inspectCredential = defineHandler({ method: "get", path: "/{id}" }, (context) =>
  context.json({ id: context.req.param("id") }),
);

const rotateCredential = defineHandler({ method: "post", path: "/{id}/rotate" }, (context) =>
  context.json({ id: context.req.param("id"), rotated: true }),
);

export default defineController({
  base: "/credentials",
  middleware: [requireSession],
  routes: [inspectCredential, rotateCredential],
});
```

```ts
// controllers/auth/index.ts
import { defineController, defineHandler } from "@chiballc/utils/ho3";
import credentials from "./credentials";

const session = defineHandler({ method: "get", path: "/session" }, (context) => {
  return context.json({ authenticated: true });
});

const fallback = defineHandler({ method: "all", path: "/*" }, (context) => {
  return context.notFound();
});

export default defineController({
  base: "/auth",
  routes: [session, credentials, fallback],
});
```

Mounted under `createHo3App({ base: "/api/v1" })`, this tree registers:

```text
GET  /api/v1/auth/session
GET  /api/v1/auth/credentials/{id}
POST /api/v1/auth/credentials/{id}/rotate
ALL  /api/v1/auth/*
```

## Type composition

### Project-wide augmentation

Module augmentation is the recommended base environment. It is available to handlers, middleware, controllers, hooks, and the returned application without call-site generics.

```ts
import { defineHandler, defineMiddleware } from "@chiballc/utils/ho3";

interface WorkerEnv {
  Bindings: {
    DATABASE_URL: string;
    ASSET_ORIGIN: string;
  };
  Variables: {
    requestId: string;
    logger: {
      info(fields: Record<string, unknown>): void;
    };
  };
}

declare module "@chiballc/utils/ho3" {
  interface Ho3Env {
    Bindings: WorkerEnv["Bindings"];
    Variables: WorkerEnv["Variables"];
  }
}

const requestState = defineMiddleware(async (context, next) => {
  context.set("requestId", crypto.randomUUID());
  context.set("logger", {
    info(fields) {
      console.info(fields);
    },
  });
  await next();
});

const route = defineHandler({ method: "get", path: "/" }, (context) => {
  context.get("logger").info({ requestId: context.get("requestId") });
  return context.json({ databaseConfigured: Boolean(context.env.DATABASE_URL) });
});
```

The augmentation declares the contract; `requestState` initializes its variables. Install it at application or controller scope before executing `route`. Bindings such as `DATABASE_URL` still come from the runtime environment.

### Type-flow matrix

Middleware always executes at its configured runtime scope, but TypeScript can augment a callback only where that callback is defined. This distinction explains when to use prebuilt handlers and when to use the scoped callback overload.

| Type source               | Runtime scope                                                                       | Compile-time scope                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Module-augmented `Ho3Env` | None by itself; the platform supplies bindings and middleware initializes variables | Every unparameterized handler, middleware, controller, hook, and app.                                        |
| Application middleware    | Its configured path under the application base                                      | Returned `Ho3App` and post-middleware hooks; it does not retroactively retype prebuilt handlers.             |
| Controller middleware     | Its configured path under the controller base                                       | Controller installer, `methodNotAllowed`, and handlers/controllers created by its scoped callback factories. |
| Route middleware          | One handler                                                                         | That handler callback through `HandlerEnv`.                                                                  |

At runtime the effective context is cumulative. At compile time a prebuilt handler sees `Ho3Env` plus its own route middleware because its callback was checked before a parent application or controller chose to mount it.

Type inference assumes that variables contributed by application or controller middleware are available across the typed composition scope. If `defineMiddleware` narrows `options.base` or `options.method`, that middleware may not execute for every typed route or hook. Use narrowed middleware for side effects that do not contribute required variables, or move variable-producing middleware to the exact route that consumes it.

### Explicit handler environments

Pass an environment as the first `defineHandler` type argument when a prebuilt handler should declare a requirement that is not project-wide:

```ts
import { defineController, defineHandler, defineMiddleware } from "@chiballc/utils/ho3";

type RequestContextEnv = {
  Variables: {
    requestId: string;
  };
};

const requestContext = defineMiddleware<RequestContextEnv>(async (context, next) => {
  context.set("requestId", crypto.randomUUID());
  await next();
});

const currentUser = defineHandler<RequestContextEnv>({ method: "get", path: "/me" }, (context) => {
  return context.json({
    requestId: context.get("requestId"), // string
  });
});

const users = defineController({
  base: "/users",
  middleware: [requestContext],
  routes: currentUser,
});
```

The explicit type argument checks the handler callback; `requestContext` provides the declared variable at runtime. The later `defineController` call cannot retroactively infer its middleware environment into the already-created `currentUser` handler.

When the handler requirement should be derived from a middleware tuple instead of repeated manually, compute it with `ControllerEnv`:

```ts
import type { ControllerEnv, Ho3Env } from "@chiballc/utils/ho3";

type UsersEnv = ControllerEnv<Ho3Env, [typeof requestContext]>;

const currentUser = defineHandler<UsersEnv>({ method: "get", path: "/me" }, (context) => {
  // Includes augmented Ho3Env plus RequestContextEnv.
  return context.json({ requestId: context.get("requestId") });
});
```

`defineHandler<BaseEnv, Options>` also accepts an explicit second type argument for reusable option objects, although ordinary application code should let `Options` infer from the first argument.

### Global middleware augmentation

Typed global middleware contributes its environment to the returned app and post-middleware hooks. This example continues from the project-wide recipe above: `requestState` initializes the `requestId` declared by `Ho3Env`, while `tenantContext` contributes and initializes `tenantId`.

```ts
import { createHo3App, defineMiddleware } from "@chiballc/utils/ho3";

type TenantEnv = {
  Variables: {
    tenantId: string;
  };
};

const tenantContext = defineMiddleware<TenantEnv>(async (context, next) => {
  context.set("tenantId", context.req.header("x-tenant-id") ?? "public");
  await next();
});

const app = createHo3App({
  middleware: [requestState, tenantContext],
  hooks: {
    "build:post:middleware"(app) {
      app.get("/tenant", (context) => {
        // Ho3Env variables and TenantEnv variables are both available.
        return context.json({
          requestId: context.get("requestId"),
          tenantId: context.get("tenantId"),
        });
      });
    },
  },
});
```

### Route middleware augmentation

Pass a Hono middleware callback through a handler's `middleware` option when only one route needs a variable. The handler callback infers that variable automatically.

```ts
import { defineHandler } from "@chiballc/utils/ho3";
import type { MiddlewareHandler } from "hono";

type ProjectEnv = {
  Variables: {
    projectId: string;
  };
};

const loadProject: MiddlewareHandler<ProjectEnv> = async (context, next) => {
  context.set("projectId", context.req.param("projectId"));
  await next();
};

const project = defineHandler(
  {
    method: "get",
    path: "/{projectId}",
    middleware: loadProject,
  },
  (context) => {
    return context.json({ projectId: context.get("projectId") });
  },
);
```

Multiple route middleware callbacks can be supplied as a readonly array. Their environments are intersected in the handler callback.

### Controller middleware and prebuilt handlers

Controller middleware is registered before the routes in its subtree and augments the controller installer and `methodNotAllowed` context. Without a narrowed `options.base` or `options.method`, it executes for the whole subtree. This example assumes the quick-start `Ho3Env`, where `requestId` is project-wide:

```ts
import { defineController, defineHandler, defineMiddleware } from "@chiballc/utils/ho3";

type ActorEnv = {
  Variables: {
    actorId: string;
  };
};

const actorContext = defineMiddleware<ActorEnv>(async (context, next) => {
  context.set("actorId", "user-123");
  await next();
});

const profile = defineHandler({ method: "get", path: "/profile" }, (context) => {
  return context.json({ requestId: context.get("requestId") });
});

const account = defineController({
  base: "/account",
  middleware: [actorContext],
  routes: profile,
  methodNotAllowed: (context, allow) => {
    return context.json({ actorId: context.get("actorId"), code: "METHOD_NOT_ALLOWED" }, 405, { Allow: allow });
  },
});
```

A prebuilt handler such as `profile` cannot retroactively infer variables introduced later by `account.middleware`. It still receives that middleware at runtime, but its compile-time context consists of `Ho3Env` plus its own route middleware.

Choose one of these patterns when the handler itself needs `actorId`:

1. Put `actorId` in the project-wide `Ho3Env` when it is an application invariant.
2. Attach `actorContext.handler` as route middleware when the requirement belongs to one handler.
3. Use scoped callback composition when the requirement belongs to an inline subtree.

### Scoped callback composition

The callback overload exists for contextual typing. Its `defineHandler` and `defineController` arguments are scoped to the parent controller middleware.

```ts
import { defineController, defineMiddleware } from "@chiballc/utils/ho3";

type SessionEnv = {
  Variables: {
    actorId: string;
  };
};

type OrganizationEnv = {
  Variables: {
    organizationId: string;
  };
};

const sessionContext = defineMiddleware<SessionEnv>(async (context, next) => {
  context.set("actorId", "user-123");
  await next();
});

const organizationContext = defineMiddleware<OrganizationEnv>(async (context, next) => {
  context.set("organizationId", context.req.param("organizationId"));
  await next();
});

const organizations = defineController("/organizations", [sessionContext], (_defineHandler, defineController) => [
  defineController("/{organizationId}", [organizationContext], (defineHandler) => [
    defineHandler({ method: "get", path: "/summary" }, (context) => {
      return context.json({
        actorId: context.get("actorId"),
        organizationId: context.get("organizationId"),
      });
    }),
  ]),
]);
```

Handlers and child controllers have the same runtime installation behavior in both forms. The callback form additionally accepts interleaved middleware definitions. Use the object form for imported, folder-owned modules. Use the callback form only where contextual middleware inference or intentional interleaving earns the additional syntax.

Conceptually, the callback overload is:

```ts
defineController(
  base,
  middleware,
  (defineHandler, defineController) => entries,
  methodNotAllowed?,
);
```

The callback may return scoped handler definitions, child controller installers, and middleware definitions. Prefer the controller's `middleware` argument for subtree policy; return a middleware definition as an entry only when its registration position among callback entries is intentional.

## Middleware ownership recipes

Place middleware at the narrowest scope that owns the invariant:

| Scope       | Configuration                      | Good fit                                                                  |
| ----------- | ---------------------------------- | ------------------------------------------------------------------------- |
| Application | `createHo3App({ middleware })`     | Request IDs, logging, configuration, CORS.                                |
| Controller  | `defineController({ middleware })` | Session authority, tenant scope, feature-wide limits.                     |
| Route       | `defineHandler({ middleware })`    | Resource loading, mutation-only origin checks, one endpoint's body limit. |

Controller middleware definitions can also declare an explicit relative base or registration method:

```ts
import { defineController, defineHandler, defineMiddleware } from "@chiballc/utils/ho3";

const auditMutations = defineMiddleware(
  async (context, next) => {
    await next();
    console.info(context.req.method, context.req.path, context.res.status);
  },
  {
    method: "use",
    base: "/projects/*",
  },
);

const adminProject = defineHandler({ method: "get", path: "/projects/{id}" }, (context) =>
  context.json({ id: context.req.param("id") }),
);

const admin = defineController({
  base: "/admin",
  middleware: [auditMutations],
  routes: adminProject,
});
```

The middleware above is registered at `/admin/projects/*` because its base is relative to the controller.

## OpenAPI handlers

When a handler has a complete Zod OpenAPI route configuration, including `responses`, Ho3 registers it with `app.openapi`. Runtime selection is based on the presence of `responses`; callback typing additionally checks that the options satisfy `RouteConfig`. Routes without `responses`, plus `use` and `all` handlers, use ordinary Hono registration.

`Method` supports the OpenAPI route methods except explicit `head` and `trace`, and adds Hono's `use` and `all`. Define a `get` route when `HEAD` should be advertised automatically. An exact-path `all` route is concrete and handles every method at that path; an `all` route whose path contains `*` is treated as a deferred fallback.

Prefer `defineMiddleware` for reusable middleware policy and environment inference. A `defineHandler({ method: "use" })` entry is a raw Hono-style route registration inside a controller; it is not an exact method and does not contribute to generated 405 metadata.

```ts
import { z } from "@hono/zod-openapi";
import { defineController, defineHandler } from "@chiballc/utils/ho3";

const userSchema = z.object({
  id: z.string(),
  displayName: z.string(),
});

const getUser = defineHandler(
  {
    method: "get",
    path: "/{userId}",
    operationId: "getUser",
    summary: "Get one user",
    tags: ["Users"],
    request: {
      params: z.object({ userId: z.string().min(1) }),
    },
    responses: {
      200: {
        description: "User",
        content: {
          "application/json": { schema: userSchema },
        },
      },
      404: {
        description: "User not found",
      },
    },
  },
  async (context) => {
    const { userId } = context.req.valid("param");
    return context.json({ id: userId, displayName: "Ada" }, 200);
  },
);

export default defineController({
  base: "/users",
  routes: getUser,
});
```

Use OpenAPI-style `{parameter}` paths in handler definitions. Ho3 converts them to Hono's `:parameter` form for ordinary handlers while retaining OpenAPI registration for complete route configurations.

## Recipe: mutation middleware

Route middleware can be one callback or a readonly array. This keeps read and mutation policies separate without creating another controller.

```ts
import { defineController, defineHandler } from "@chiballc/utils/ho3";
import type { MiddlewareHandler } from "hono";

const requireJson: MiddlewareHandler = async (context, next) => {
  const mediaType = context.req.header("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    return context.json({ code: "UNSUPPORTED_MEDIA_TYPE" }, 415);
  }
  await next();
};

const requireTrustedOrigin: MiddlewareHandler = async (context, next) => {
  if (context.req.header("origin") !== "https://app.example.com") {
    return context.json({ code: "FORBIDDEN" }, 403);
  }
  await next();
};

const inspect = defineHandler({ method: "get", path: "/{id}" }, (context) =>
  context.json({ id: context.req.param("id") }),
);

const update = defineHandler(
  {
    method: "patch",
    path: "/{id}",
    middleware: [requireJson, requireTrustedOrigin],
  },
  (context) => context.json({ id: context.req.param("id"), updated: true }),
);

const records = defineController({
  base: "/records",
  routes: [inspect, update],
});
```

## 405 responses and fallback ordering

Set `methodNotAllowed` on a controller to generate exact-path 405 handlers. Ho3 aggregates supported methods for equivalent route shapes, adds `HEAD` when `GET` exists, sorts the result, and supplies it as `allow`.

```ts
import { defineController, defineHandler } from "@chiballc/utils/ho3";

const inspect = defineHandler({ method: "get", path: "/{id}" }, (context) =>
  context.text(`inspect ${context.req.param("id")}`),
);

const replace = defineHandler({ method: "put", path: "/{recordId}" }, (context) =>
  context.text(`replace ${context.req.param("recordId")}`),
);

const fallback = defineHandler({ method: "all", path: "/*" }, (context) => context.notFound());

const records = defineController({
  base: "/records",
  routes: [fallback, inspect, replace],
  methodNotAllowed: (context, allow) => {
    return context.json({ code: "METHOD_NOT_ALLOWED" }, 405, { Allow: allow });
  },
});
```

For `/records/123`, an unsupported `POST` receives `Allow: GET, HEAD, PUT`. Parameter names do not split the route shape, so `/{id}` and `/{recordId}` contribute to the same header.

Ho3 coordinates fallbacks across library-created controller trees:

1. Controller middleware is installed first.
2. Concrete handlers and child controllers are installed.
3. Exact `methodNotAllowed` handlers are installed.
4. `all` handlers whose paths contain `*` are installed last.

This ordering applies regardless of where a wildcard appears in `routes`, so a parent fallback cannot shadow a child route. Custom `ControllerInstaller` functions that register routes directly are responsible for their own ordering and cannot contribute methods to Ho3's aggregated `Allow` metadata.

## Root controllers

`defineRootController` ignores application and ancestor bases. Use it for discovery endpoints that must remain at a protocol-defined absolute path.

```ts
import { createHo3App, defineController, defineHandler, defineRootController } from "@chiballc/utils/ho3";

const keys = defineHandler({ method: "get", path: "/.well-known/jwks.json" }, (context) => context.json({ keys: [] }));

const discovery = defineRootController({
  routes: keys,
});

const auth = defineController({
  base: "/auth",
  routes: discovery,
});

const app = createHo3App({
  base: "/api/v1",
  controllers: [auth],
});
```

The route is `/.well-known/jwks.json`, not `/api/v1/auth/.well-known/jwks.json`. Root controllers retain their absolute behavior even when imported through another controller.

Root controllers support the same `middleware`, `routes`, and `methodNotAllowed` properties as ordinary controllers, except they do not accept `base`.

When an absolute inline subtree needs contextual middleware inference, use the root callback overload:

```ts
defineRootController(
  middleware,
  (defineHandler, defineController) => entries,
  methodNotAllowed?,
);
```

Its scoped factories and positional fallback follow the same rules as the ordinary controller callback overload; only base composition differs.

## Reusable callbacks and common exported types

Use `Handler` for an ordinary reusable Hono callback that relies on augmented `Ho3Env`. This example assumes the quick-start `requestId` augmentation:

```ts
import { defineHandler, type Handler } from "@chiballc/utils/ho3";

export const serveHealth: Handler = (context) => {
  return context.json({ requestId: context.get("requestId") });
};

export default defineHandler({ method: "get", path: "/health" }, serveHealth);
```

Use `OpenAPIHandler<Options>` when a callback should be checked against one complete route configuration:

```ts
import { defineHandler, type OpenAPIHandler } from "@chiballc/utils/ho3";

const options = {
  method: "get",
  path: "/health",
  responses: {
    200: { description: "Healthy" },
  },
} as const;

const serveHealth: OpenAPIHandler<typeof options> = (context) => {
  return context.text("ok", 200);
};

export default defineHandler(options, serveHealth);
```

`HandlerCallback<Env, Options>` selects OpenAPI or ordinary Hono callback typing using the same rule as `defineHandler`. Ho3 also exports:

| Type                                  | Use                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| `HandlerOptions`                      | Build helpers that accept Ho3 handler configuration.                            |
| `HandlerEnv<BaseEnv, Options>`        | Compute the environment after route middleware.                                 |
| `ControllerEnv<BaseEnv, Middlewares>` | Compute the environment after controller middleware.                            |
| `EnvOfMiddleware<Middleware>`         | Extract an environment from a Hono middleware callback.                         |
| `DefineHandler<BaseEnv>`              | Type a scoped handler factory.                                                  |
| `DefineController<BaseEnv>`           | Type a scoped controller factory.                                               |
| `HandlerDefinition`                   | Type a reusable leaf route definition.                                          |
| `ControllerDefinition`                | Type an object-form controller definition.                                      |
| `RootControllerDefinition`            | Type an object-form absolute controller definition.                             |
| `ControllerInstaller`                 | Integrate a controller with another composition system.                         |
| `ControllerCollection`                | Type one installer or a readonly installer array.                               |
| `MiddlewareHandler`                   | Type a reusable Hono middleware callback; its environment defaults to `Ho3Env`. |
| `MiddlewareDefinition`                | Type the value returned by `defineMiddleware`.                                  |
| `Method`                              | Type supported route and middleware registration methods.                       |
| `InstallConfig`                       | Type the optional `{ base }` installer configuration.                           |
| `Ho3App<AppEnv>`                      | Type the returned Hono application and its hooks.                               |
| `Ho3Hooks<AppEnv>`                    | Type the synchronous composition lifecycle.                                     |
| `CreateHo3AppOptions`                 | Type reusable application-composition options.                                  |

Prefer inference and `Ho3Env` augmentation in application code. The exported computation and installer types are primarily for framework integrations and reusable helpers.

## Composition hooks

`createHo3App` installs global middleware in array order, installs controllers, and exposes a typed [Hookable](https://github.com/unjs/hookable) lifecycle.

| Hook                     | Available environment           | Typical use                                              |
| ------------------------ | ------------------------------- | -------------------------------------------------------- |
| `build:pre:middleware`   | `Ho3Env` only                   | Register routes that must precede global middleware.     |
| `build:post:middleware`  | `Ho3Env` plus global middleware | Register framework routes that need application context. |
| `build:post:controllers` | Same augmented app              | Publish OpenAPI documents or final fallbacks.            |

```ts
import { createHo3App } from "@chiballc/utils/ho3";
import requestContext from "./middleware/request-context";
import tenantContext from "./middleware/tenant-context";
import auth from "./controllers/auth";
import users from "./controllers/users";

const app = createHo3App({
  middleware: [requestContext, tenantContext],
  controllers: [users, auth],
  hooks: {
    build: {
      pre: {
        middleware(app) {
          app.get("/live", (context) => context.text("ok"));
        },
      },
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

Composition hooks must be synchronous because `createHo3App` returns a fully registered application synchronously. Returning a promise throws a `TypeError` during composition.

## Manual composition

Use `installMiddleware`, `installController`, or `installControllers` when route registration must occur between external composition steps.

```ts
import { OpenAPIHono } from "@hono/zod-openapi";
import { installControllers, installMiddleware } from "@chiballc/utils/ho3";
import auth from "./controllers/auth";
import discovery from "./controllers/discovery";
import users from "./controllers/users";
import requestContext from "./middleware/request-context";

const app = new OpenAPIHono();

installMiddleware(app, requestContext, { base: "/api/v1" });
installControllers(app, [discovery, [users, auth]], {
  base: "/api/v1",
});
```

`installController` installs one controller. `installControllers` accepts the same controller collections used by `createHo3App` and coordinates their fallback ordering in one installation pass. Use the collection installer instead of invoking several controller functions independently when their wildcard or 405 ordering overlaps.

## Testing a controller tree

Controllers are synchronous definitions and can be mounted into an isolated app without starting a server:

```ts
import { describe, expect, it } from "vitest";
import { createHo3App } from "@chiballc/utils/ho3";
import records from "./records";

describe("records controller", () => {
  const app = createHo3App({
    base: "/api",
    controllers: [records],
  });

  it("routes concrete handlers before fallbacks", async () => {
    const response = await app.request("/api/records/123");
    expect(response.status).toBe(200);
  });

  it("reports supported methods", async () => {
    const response = await app.request("/api/records/123", {
      method: "POST",
    });
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, HEAD, PUT");
  });
});
```

For typed bindings, pass the request environment as the third argument to Hono's `app.request`, or use the Worker/runtime test harness that owns those bindings.

## Choosing a composition form

Use this decision guide:

| Scenario                                                         | Recommended form                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------- |
| Imported feature module with prebuilt handlers                   | Object controller with `routes`.                        |
| One route today, likely more later                               | Object controller with a singular `routes` value.       |
| Nested folder-owned feature modules                              | Object controllers imported into the parent's `routes`. |
| Handler needs only project-wide variables                        | Module-augmented `Ho3Env`.                              |
| Handler needs route-specific variables                           | Handler `middleware` option.                            |
| Inline subtree needs variables from parent controller middleware | Callback overload with scoped factories.                |
| Protocol route must ignore `/api` and parent bases               | `defineRootController`.                                 |
| Integration with an existing Hono registration sequence          | Manual installers.                                      |

The object form should cover most application composition. The callback overload is intentionally retained for the narrower case where contextual middleware inference is more valuable than a static, importable route module.
