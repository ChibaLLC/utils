import {
  defineNuxtModule,
  addPlugin,
  createResolver,
  addServerHandler,
  addServerPlugin,
  updateRuntimeConfig,
  addImportsSources,
  addServerImports,
} from "@nuxt/kit";
import type { KibaoConfig } from "./types";
import { reconsileConfig, setEnv } from "./runtime/env";
import { entries, isEmpty } from "@chiballc/utils";
import { consola } from "consola";
import { createTypeTemplates, printOpenBaoConfig } from "./utils";
import { getAllVars, type KibaoCredentials } from "./runtime/utils";

export type PublicKibaoConfig = Omit<KibaoConfig["kibao"], "openbao"> & {
  openbao: {
    public: KibaoCredentials;
  };
};

declare module "@nuxt/schema" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface RuntimeConfig extends KibaoConfig {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface PublicRuntimeConfig extends PublicKibaoConfig {}
}

export default defineNuxtModule<KibaoConfig["kibao"]>({
  meta: {
    name: "kibao",
    configKey: "kibao",
  },
  defaults: {
    disabled: false,
  },
  async setup(options, nuxt) {
    const console = consola.withTag("kibao");
    const resolver = createResolver(import.meta.url);

    if (options.disabled) {
      return;
    }

    const resolved = reconsileConfig(options, nuxt.options.runtimeConfig);
    if (resolved.disabled) {
      return;
    }

    if (isEmpty(resolved.openbao)) {
      console.warn("No openbao configuration found, skipping...");
      return;
    } else {
      console.success("Found openbao configuration");
      printOpenBaoConfig(resolved.openbao);
    }

    const imports = ["OpenBaoOptions", "KibaoConfig", "KibaoVars"];
    addImportsSources({
      from: resolver.resolve("./types"),
      imports,
      type: true,
    });

    imports.forEach((i) => {
      addServerImports({
        from: resolver.resolve("./types"),
        name: i,
        type: true,
      });
    });

    const groupedVars = await getAllVars(resolved.openbao);
    const allVars: Record<string, string> = {};

    for (const [access, vars] of entries(groupedVars)) {
      if (!vars) {
        throw new Error("Unable to obtain " + String(access) + " variables from openbao");
      }

      setEnv({ vars });
      Object.assign(allVars, vars);
    }

    createTypeTemplates(groupedVars);

    updateRuntimeConfig({
      public: {
        kibao: {
          disabled: resolved.disabled,
          baoServerURL: resolved.baoServerURL,
          openbao: {
            public: groupedVars.public || ({} as any),
          },
          serverURL: resolved.serverURL,
          vars: groupedVars.public,
        } satisfies Omit<KibaoConfig["kibao"], "openbao"> & {
          openbao: {
            public: KibaoCredentials;
          };
        },
      },
      kibao: {
        ...resolved,
        baoServerURL: resolved.baoServerURL,
        vars: allVars,
      },
    });

    addPlugin({
      src: resolver.resolve("./runtime/app/plugin"),
      order: 0,
    });

    addServerPlugin(resolver.resolve("./runtime/server/plugins/plugin"));

    addServerHandler({
      handler: resolver.resolve("./runtime/server/routes/bao-proxy"),
      route: "/bao-proxy/**",
    });
  },
});
