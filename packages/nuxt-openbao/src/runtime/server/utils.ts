import { useRuntimeConfig } from "nitropack/runtime";
import { applyRuntimeConfigEnv, reconsileConfig, setEnv, crawlVarsFromEnv } from "../env";
import { getAllVars } from "../utils";
import { entries } from "@chiballc/utils";
import { defu } from "defu";
import { consola } from "consola";
import type { NitroApp } from "nitropack";
import type { KibaoConfig, KibaoVars } from "~/src/types";
import type { OneOf } from "@chiballc/types";
import type { H3Event } from "h3";

const console = consola.withTag("kibao");
export async function injectVars(options: OneOf<[{ app: NitroApp }, { event: H3Event }]>) {
  const init = async (event?: H3Event) => {
    const config = event ? useRuntimeConfig(event) : useRuntimeConfig();
    let kibao: Partial<KibaoConfig["kibao"]> = config.kibao || config.public.kibao || {};
    kibao = reconsileConfig(crawlVarsFromEnv(), config);
    if (kibao?.disabled) {
      return;
    }

    const refresh = async (refreshEvent?: H3Event) => {
      const refreshConfig = refreshEvent ? useRuntimeConfig(refreshEvent) : config;
      const refreshKibao = reconsileConfig(crawlVarsFromEnv(), refreshConfig);
      const vars = await getAllVars(refreshKibao.openbao || {});

      for (const [_, _vars] of entries(vars)) {
        kibao.vars = defu(_vars, kibao.vars) as KibaoVars;
        setEnv({ vars: _vars || {} });
        applyRuntimeConfigEnv(_vars || {}, refreshConfig);
      }
    };

    await refresh(event);

    return {
      get data() {
        return kibao.vars || {};
      },
      refresh,
    };
  };

  if (options.app) {
    const vars = await init().catch(console.error);
    options.app.hooks.hook("request", async (event) => {
      event.context.vars = vars;
      await vars?.refresh(event);
      event.context._kibaoVarsRefreshed = true;
    });
  } else if (options.event) {
    if (options.event.context.vars?.refresh && !options.event.context._kibaoVarsRefreshed) {
      await options.event.context.vars.refresh(options.event);
    } else {
      console.info("Injecting vars because they were missed on startup");
      options.event.context.vars = await init(options.event).catch(console.error);
    }
  }
}
