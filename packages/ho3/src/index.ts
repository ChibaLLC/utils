import { createRoute, OpenAPIHono, type RouteConfig, type RouteHandler } from "@hono/zod-openapi";
import type {
  Context,
  Env,
  Handler as HonoHandler,
  MiddlewareHandler as HonoMiddlewareHandler,
} from "hono";
import { createHooks, type Hookable, type NestedHooks } from "hookable";
import { joinURL } from "ufo";

export interface InstallConfig {
  base?: string;
}

export interface Ho3Env extends Env {}

export type Handler<T extends Env = Ho3Env> = HonoHandler<T>;

export type MiddlewareHandler<T extends Env = Ho3Env> = HonoMiddlewareHandler<T>;

export type OpenAPIHandler<Options extends RouteConfig, T extends Env = Ho3Env> = RouteHandler<Options, T>;

export type Method = Exclude<RouteConfig["method"], "head" | "trace"> | "use" | "all";

export type MiddlewareDefinition<T extends Env = Ho3Env> = {
  kind: "middleware";
  handler: MiddlewareHandler<T>;
  options?: {
    base?: string;
    method?: Method;
  };
};

export type HandlerDefinition<T extends Env = Ho3Env> = {
  kind: "handler";
  options: Partial<Omit<RouteConfig, "method" | "path">> & {
    method: Method;
    path: string;
  };
  callback: RouteHandler<RouteConfig, T> | Handler<T>;
};

type AnyMiddleware = HonoMiddlewareHandler<any, any, any, any>;
type AnyMiddlewareDefinition = MiddlewareDefinition<any>;
type BaseHandlerOptions = Omit<HandlerDefinition["options"], "middleware">;
export type HandlerOptions = BaseHandlerOptions & {
  middleware?: AnyMiddleware | readonly AnyMiddleware[];
};
type MiddlewareMember<Options> = Options extends { middleware: infer Middleware }
  ? Middleware extends readonly AnyMiddleware[]
    ? Middleware[number]
    : Middleware extends AnyMiddleware
      ? Middleware
      : never
  : never;
type NonAny<T> = 0 extends 1 & T ? never : T;
export type EnvOfMiddleware<Middleware> = Middleware extends HonoMiddlewareHandler<infer MiddlewareEnv, any, any, any>
  ? NonAny<MiddlewareEnv>
  : never;
type UnionToIntersection<T> = (T extends unknown ? (value: T) => void : never) extends (
  value: infer Intersection,
) => void
  ? Intersection
  : never;
type RouteMiddlewareEnv<Options> = EnvOfMiddleware<MiddlewareMember<Options>>;
export type HandlerEnv<BaseEnv extends Env, Options> = [RouteMiddlewareEnv<Options>] extends [never]
  ? BaseEnv
  : BaseEnv & UnionToIntersection<RouteMiddlewareEnv<Options>>;
type DefinitionHandler<Definition> = Definition extends { handler: infer Middleware } ? Middleware : never;
type ControllerMiddlewareEnv<Middlewares extends readonly AnyMiddlewareDefinition[]> = EnvOfMiddleware<
  DefinitionHandler<Middlewares[number]>
>;
export type ControllerEnv<BaseEnv extends Env, Middlewares extends readonly AnyMiddlewareDefinition[]> = [
  ControllerMiddlewareEnv<Middlewares>,
] extends [never]
  ? BaseEnv
  : BaseEnv & UnionToIntersection<ControllerMiddlewareEnv<Middlewares>>;
export type HandlerCallback<BaseEnv extends Env, Options extends HandlerOptions> = Options extends RouteConfig
  ? RouteHandler<Options, NoInfer<HandlerEnv<BaseEnv, Options>>>
  : Handler<NoInfer<HandlerEnv<BaseEnv, Options>>>;
export type DefineHandler<BaseEnv extends Env = Ho3Env> = <const Options extends HandlerOptions>(
  options: Options,
  callback: HandlerCallback<BaseEnv, Options>,
) => HandlerDefinition<HandlerEnv<BaseEnv, Options>>;
type AnyControllerEntry = HandlerDefinition<any> | MiddlewareDefinition<any>;
type RuntimeApp = Record<Method, (path: string, handler: Handler<any>) => unknown> & {
  openapi: (route: RouteConfig, handler: RouteHandler<RouteConfig, any>) => unknown;
};

function toHonoPath(path: string): string {
  return path.replaceAll(/\/{(.+?)}/g, "/:$1");
}

export type ControllerInstaller<T extends Env = Ho3Env> = {
  (app: OpenAPIHono<T>, config: Required<InstallConfig>): void;
  root?: boolean;
};

export type ControllerCollection<T extends Env = Ho3Env> =
  | ControllerInstaller<T>
  | readonly ControllerInstaller<T>[];

type AppEnv<Middlewares extends readonly AnyMiddlewareDefinition[]> = [
  ControllerMiddlewareEnv<Middlewares>,
] extends [never]
  ? Ho3Env
  : UnionToIntersection<ControllerMiddlewareEnv<Middlewares>>;

export interface Ho3Hooks<AppEnvironment extends Env = Ho3Env> {
  "build:pre:middleware": (app: OpenAPIHono<Ho3Env>) => void;
  "build:post:middleware": (app: OpenAPIHono<AppEnvironment>) => void;
  "build:post:controllers": (app: OpenAPIHono<AppEnvironment>) => void;
}

export type Ho3App<AppEnvironment extends Env = Ho3Env> = OpenAPIHono<AppEnvironment> & {
  hooks: Hookable<Ho3Hooks<AppEnvironment>>;
};

export interface CreateHo3AppOptions<
  Middlewares extends readonly AnyMiddlewareDefinition[] = readonly AnyMiddlewareDefinition[],
> extends InstallConfig {
  middleware?: Middlewares;
  controllers?: readonly ControllerCollection<any>[];
  hooks?: NestedHooks<Ho3Hooks<AppEnv<Middlewares>>>;
}

function callCompositionHook<AppEnvironment extends Env, Name extends keyof Ho3Hooks<AppEnvironment> & string>(
  hooks: Hookable<Ho3Hooks<AppEnvironment>>,
  name: Name,
  app: Parameters<Ho3Hooks<AppEnvironment>[Name]>[0],
): void {
  hooks.callHookWith(
    (callbacks, arguments_) => {
      for (const callback of callbacks) {
        const result = callback(...arguments_);
        if (result && typeof result.then === "function") {
          throw new TypeError(`Ho3 composition hook ${name} must be synchronous`);
        }
      }
    },
    name,
    [app] as Parameters<Ho3Hooks<AppEnvironment>[Name]>,
  );
}

export function defineMiddleware<T extends Env = Ho3Env>(
  handler: MiddlewareHandler<T>,
  options?: MiddlewareDefinition<T>["options"],
): MiddlewareDefinition<T> {
  return options ? { kind: "middleware", handler, options } : { kind: "middleware", handler };
}

export function defineHandler<
  T extends Env = Ho3Env,
  const Options extends HandlerOptions = HandlerOptions,
>(options: Options, callback: HandlerCallback<T, Options>): HandlerDefinition<HandlerEnv<T, Options>> {
  return { kind: "handler", options, callback } as HandlerDefinition<HandlerEnv<T, Options>>;
}

export function installMiddleware<T extends Env>(
  app: OpenAPIHono<T>,
  middleware: MiddlewareDefinition<any>,
  config: InstallConfig = {},
): void {
  const method = middleware.options?.method ?? "use";
  const path = joinURL(config.base ?? "", middleware.options?.base ?? "*");
  const runtimeApp = app as unknown as RuntimeApp;

  runtimeApp[method](path, middleware.handler as Handler<any>);
}

function installHandler<T extends Env>(
  app: OpenAPIHono<T>,
  handler: HandlerDefinition<any>,
  config: Required<InstallConfig>,
): void {
  const path = joinURL(config.base, handler.options.path);
  const { method, responses } = handler.options;
  const runtimeApp = app as unknown as RuntimeApp;

  if (method === "use" || method === "all" || !responses) {
    runtimeApp[method](toHonoPath(path), handler.callback as Handler<any>);
    return;
  }

  const route = createRoute({ ...handler.options, path } as RouteConfig);
  runtimeApp.openapi(route, handler.callback as RouteHandler<RouteConfig, any>);
}

export function defineController<
  BaseEnv extends Env = Ho3Env,
  const Middlewares extends readonly AnyMiddlewareDefinition[] = readonly AnyMiddlewareDefinition[],
  const Entries extends readonly AnyControllerEntry[] = readonly AnyControllerEntry[],
>(
  base: string,
  middlewares: Middlewares,
  createHandlers: (defineHandler: DefineHandler<ControllerEnv<BaseEnv, Middlewares>>) => Entries,
  methodNotAllowed?: (context: Context<NoInfer<ControllerEnv<BaseEnv, Middlewares>>>, allow: string) => Response,
): ControllerInstaller<ControllerEnv<BaseEnv, Middlewares>> {
  type ScopedEnv = ControllerEnv<BaseEnv, Middlewares>;
  const defineScopedHandler = defineHandler as DefineHandler<ScopedEnv>;
  const entries = createHandlers(defineScopedHandler);

  return (app, config) => {
    const scopedConfig = { base: joinURL(config.base, base) };

    for (const middleware of middlewares) {
      installMiddleware(app, middleware, scopedConfig);
    }

    const wildcardHandlers = entries.filter(
      (entry): entry is HandlerDefinition<ScopedEnv> => entry.kind === "handler" && entry.options.method === "all",
    );

    for (const entry of entries) {
      if (entry.kind === "handler" && entry.options.method === "all") continue;

      if (entry.kind === "handler") {
        installHandler(app, entry, scopedConfig);
      } else {
        installMiddleware(app, entry, scopedConfig);
      }
    }

    if (methodNotAllowed) {
      const routes = new Map<string, Set<string>>();

      for (const entry of entries) {
        if (
          entry.kind !== "handler" ||
          entry.options.method === "all" ||
          entry.options.method === "use" ||
          entry.options.path.includes("*")
        ) {
          continue;
        }

        const path = toHonoPath(joinURL(scopedConfig.base, entry.options.path));
        const methods = routes.get(path) ?? new Set<string>();
        methods.add(entry.options.method.toUpperCase());
        if (entry.options.method === "get") methods.add("HEAD");
        routes.set(path, methods);
      }

      for (const [path, methods] of routes) {
        const allow = [...methods].sort().join(", ");
        app.all(path, (context: Context<ScopedEnv>) => methodNotAllowed(context, allow));
      }
    }

    for (const handler of wildcardHandlers) {
      installHandler(app, handler, scopedConfig);
    }
  };
}

export function defineRootController<
  BaseEnv extends Env = Ho3Env,
  const Middlewares extends readonly AnyMiddlewareDefinition[] = readonly AnyMiddlewareDefinition[],
  const Entries extends readonly AnyControllerEntry[] = readonly AnyControllerEntry[],
>(
  middlewares: Middlewares,
  createHandlers: (defineHandler: DefineHandler<ControllerEnv<BaseEnv, Middlewares>>) => Entries,
  methodNotAllowed?: (context: Context<NoInfer<ControllerEnv<BaseEnv, Middlewares>>>, allow: string) => Response,
): ControllerInstaller<ControllerEnv<BaseEnv, Middlewares>> {
  const controller = defineController<BaseEnv, Middlewares, Entries>(
    "/",
    middlewares,
    createHandlers,
    methodNotAllowed,
  );
  controller.root = true;
  return controller;
}

export function installController<T extends Env>(
  app: OpenAPIHono<T>,
  controller: ControllerInstaller<any>,
  config: InstallConfig = {},
): void {
  controller(app, { base: controller.root ? "" : (config.base ?? "") });
}

export function installControllers<T extends Env>(
  app: OpenAPIHono<T>,
  controllers: readonly ControllerCollection<any>[],
  config: InstallConfig = {},
): void {
  for (const collection of controllers) {
    if (Array.isArray(collection)) {
      for (const controller of collection) installController(app, controller, config);
    } else {
      installController(app, collection as ControllerInstaller<any>, config);
    }
  }
}

export function createHo3App<
  const Middlewares extends readonly AnyMiddlewareDefinition[] = readonly AnyMiddlewareDefinition[],
>(options: CreateHo3AppOptions<Middlewares> = {}): Ho3App<AppEnv<Middlewares>> {
  type InferredEnv = AppEnv<Middlewares>;
  const hooks = createHooks<Ho3Hooks<InferredEnv>>();
  if (options.hooks) hooks.addHooks(options.hooks);
  const app = Object.assign(new OpenAPIHono<InferredEnv>(), { hooks });

  callCompositionHook(hooks, "build:pre:middleware", app as unknown as OpenAPIHono<Ho3Env>);

  for (const middleware of options.middleware ?? []) {
    installMiddleware(app, middleware, options);
  }
  callCompositionHook(hooks, "build:post:middleware", app);

  installControllers(app, options.controllers ?? [], options);
  callCompositionHook(hooks, "build:post:controllers", app);
  return app;
}
