import { useRuntimeConfig } from "nitropack/runtime";
import { applyRuntimeConfigEnv, reconsileConfig, setEnv, crawlVarsFromEnv } from "../env";
import { getAllVars } from "../utils";
import { entries } from "@chiballc/utils";
import type { NitroApp } from "nitropack";
import type { KibaoConfig, KibaoVars } from "~/src/types";
import type { H3Event } from "h3";
import { env } from "std-env";

const KIBAO_INJECTED_ENV = "__KIBAO_INJECTED";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      __KIBAO_INJECTED?: "true" | "false";
    }
  }
}

function needsEnvInjection() {
  if (typeof process === "undefined" || !process.env) {
    return true;
  }

  return process.env[KIBAO_INJECTED_ENV] !== "true" || env[KIBAO_INJECTED_ENV] !== "true";
}

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
      const vars = await getAllVars(refreshKibao.openbao || {}, { baseURL: refreshKibao.server?.bao });

      for (const [_, _vars] of entries(vars)) {
        kibao.vars = {
          ...(kibao.vars || {}),
          ...(_vars || {}),
        } as KibaoVars;
        setEnv({ vars: { ..._vars, [KIBAO_INJECTED_ENV]: "true" } });
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
    if (needsEnvInjection()) {
      const data = vars?.data || {};
      console.info("injecting variables into process");
      setEnv({ vars: { ...data, [KIBAO_INJECTED_ENV]: "true" } });
    }
  });
}
