import { useRuntimeConfig } from "nitropack/runtime";
import { reconsileConfig, setEnv } from "../env";
import { getAllVars } from "../utils";
import { entries } from "@chiballc/utils";
import { defu } from "defu";
import { consola } from "consola";
import type { NitroApp } from "nitropack";
import type { KibaoVars } from "~/src/types";
import type { OneOf } from "@chiballc/types";
import type { H3Event } from "h3";

const console = consola.withTag("kibao");
export async function injectVars(options: OneOf<[{ app: NitroApp }, { event: H3Event }]>) {
  const config = useRuntimeConfig();
  if (config.kibao?.disabled) {
    return;
  }

  const kibao = reconsileConfig(null, config);
  const groupedVars = await getAllVars(kibao.openbao);
  for (const [_, _vars] of entries(groupedVars)) {
    kibao.vars = defu(kibao.vars, _vars) as KibaoVars;
    setEnv({ vars: _vars || {} });
  }

  const vars = {
    get data() {
      return kibao.vars || {};
    },
    async refresh() {
      const vars = await getAllVars(kibao.openbao);
      for (const [_, _vars] of entries(vars)) {
        kibao.vars = defu(kibao.vars, _vars) as KibaoVars;
        setEnv({ vars: _vars || {} });
      }
    },
  };

  if (options.app) {
    options.app.hooks.hook("request", async (event) => {
      event.context.vars = vars;
    });
  } else if (options.event) {
    if (!options.event.context.vars) {
      console.info("Injecting vars");
      options.event.context.vars = vars;
    }
  }
}
