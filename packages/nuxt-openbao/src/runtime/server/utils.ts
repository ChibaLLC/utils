import { useRuntimeConfig } from "nitropack/runtime";
import { applyRuntimeConfigEnv, reconsileConfig, setEnv, crawlVarsFromEnv } from "../env";
import { getAllVars } from "../utils";
import { entries } from "@chiballc/utils";
import type { NitroApp } from "nitropack";
import type { KibaoConfig, KibaoVars } from "~/src/types";
import type { H3Event } from "h3";

export async function injectVars(options: { app: NitroApp }) {
  const init = (event?: H3Event) => {
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
        kibao.vars = {
          ...(kibao.vars || {}),
          ...(_vars || {}),
        } as KibaoVars;
        setEnv({ vars: _vars || {} });
        applyRuntimeConfigEnv(_vars || {}, refreshConfig);
      }
    };

    return {
      get data() {
        return kibao.vars || {};
      },
      refresh,
    };
  };

  const vars = init();
  const startup = vars?.refresh();
  options.app.hooks.hook("request", async (event) => {
    await startup;
    event.context.vars = vars;
  });
}
