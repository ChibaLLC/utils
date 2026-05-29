import { useRuntimeConfig } from "nitropack/runtime";
import { reconsileConfig, setEnv } from "../env";
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
  const init = async () => {
    const config = useRuntimeConfig();
    let kibao: Partial<KibaoConfig["kibao"]> = config.kibao || config.public.kibao || {};
    kibao = reconsileConfig(null, config);
    if (kibao?.disabled) {
      return;
    }

    const groupedVars = await getAllVars(kibao.openbao || {});
    for (const [_, _vars] of entries(groupedVars)) {
      kibao.vars = defu(kibao.vars, _vars) as KibaoVars;
      setEnv({ vars: _vars || {} });
    }

    return {
      get data() {
        return kibao.vars || {};
      },
      async refresh() {
        const vars = await getAllVars(kibao.openbao || {});
        for (const [_, _vars] of entries(vars)) {
          kibao.vars = defu(kibao.vars, _vars) as KibaoVars;
          setEnv({ vars: _vars || {} });
        }
      },
    };
  };

  if (options.app) {
    const vars = await init().catch(console.error);
    options.app.hooks.hook("request", async (event) => {
      event.context.vars = vars;
    });
  } else if (options.event) {
    if (!options.event.context.vars) {
      console.info("Injecting vars because they were missed on startup");
      options.event.context.vars = await init().catch(console.error);
    }
  }
}
